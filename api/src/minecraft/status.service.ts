import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'net';
import { config } from '../config';

export interface ServerStatus {
  online: boolean;
  players: { online: number; max: number; sample: string[] };
  version: string | null;
  checkedAt: string;
}

// Any recent protocol number works for a status request.
const PROTOCOL = 775;

function varInt(value: number): Buffer {
  const bytes: number[] = [];
  do {
    let b = value & 0x7f;
    value >>>= 7;
    if (value !== 0) b |= 0x80;
    bytes.push(b);
  } while (value !== 0);
  return Buffer.from(bytes);
}

function packet(id: number, payload: Buffer): Buffer {
  const body = Buffer.concat([varInt(id), payload]);
  return Buffer.concat([varInt(body.length), body]);
}

/** Minecraft Server List Ping against the local server, cached for a few seconds. */
@Injectable()
export class StatusService {
  private readonly log = new Logger(StatusService.name);
  private cache: { at: number; value: ServerStatus } | null = null;

  async get(): Promise<ServerStatus> {
    if (this.cache && Date.now() - this.cache.at < 10_000) return this.cache.value;
    const value = await this.ping().catch((err) => {
      this.log.warn(`ping failed: ${err.message}`);
      return this.offline();
    });
    this.cache = { at: Date.now(), value };
    return value;
  }

  private offline(): ServerStatus {
    return { online: false, players: { online: 0, max: 0, sample: [] }, version: null, checkedAt: new Date().toISOString() };
  }

  private ping(): Promise<ServerStatus> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      let data = Buffer.alloc(0);
      const done = (err?: Error, status?: ServerStatus) => {
        socket.destroy();
        if (err) reject(err);
        else resolve(status!);
      };
      socket.setTimeout(4000, () => done(new Error('timeout')));
      socket.on('error', (err) => done(err));
      socket.connect(config.mcPort, config.mcHost, () => {
        const host = Buffer.from(config.mcHost);
        const port = Buffer.alloc(2);
        port.writeUInt16BE(config.mcPort);
        // Protocol version, address, port, next state 1 (status)
        const handshake = Buffer.concat([varInt(PROTOCOL), varInt(host.length), host, port, varInt(1)]);
        socket.write(packet(0, handshake));
        socket.write(packet(0, Buffer.alloc(0)));
      });
      socket.on('data', (chunk) => {
        data = Buffer.concat([data, chunk]);
        try {
          let offset = 0;
          const readVarInt = () => {
            let num = 0;
            let shift = 0;
            while (true) {
              if (offset >= data.length) throw new RangeError('incomplete');
              const b = data[offset++];
              num |= (b & 0x7f) << shift;
              if (!(b & 0x80)) return num;
              shift += 7;
            }
          };
          const length = readVarInt();
          if (data.length - offset < length) return;
          readVarInt(); // packet id
          const jsonLength = readVarInt();
          const json = JSON.parse(data.subarray(offset, offset + jsonLength).toString('utf8'));
          done(undefined, {
            online: true,
            players: {
              online: json.players?.online ?? 0,
              max: json.players?.max ?? 0,
              sample: (json.players?.sample ?? []).map((p: { name: string }) => p.name),
            },
            version: json.version?.name ?? null,
            checkedAt: new Date().toISOString(),
          });
        } catch (err) {
          if (!(err instanceof RangeError)) done(err as Error);
        }
      });
    });
  }
}
