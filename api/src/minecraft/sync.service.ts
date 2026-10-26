import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import { config } from '../config';
import { DbService } from '../db.service';

interface PlayerRow {
  uuid: string;
  name: string;
  money: number;
  kills: number;
  mobKills: number;
  deaths: number;
  playTicks: number;
  blocksMined: number;
  quizWins: number;
  quizMoney: number;
  lastSeen: Date | null;
}

const UUID_FILE = /^([0-9a-f-]{36})\.(json|yml)$/;

/** Copies player stats from the Minecraft files into Postgres once a minute (read-only on the game side). */
@Injectable()
export class SyncService implements OnApplicationBootstrap {
  private readonly log = new Logger(SyncService.name);
  private running = false;

  constructor(private readonly db: DbService) {}

  onApplicationBootstrap() {
    void this.sync();
  }

  @Interval(60_000)
  async sync() {
    if (this.running) return;
    this.running = true;
    try {
      const rows = this.collect();
      for (const r of rows) {
        // One bad row (e.g. a name clash) must not stop the rest from syncing.
        await this.db.query(
          `INSERT INTO players (uuid, name, money, kills, mob_kills, deaths, play_ticks, blocks_mined, quiz_wins, quiz_money, last_seen, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
           ON CONFLICT (uuid) DO UPDATE SET name=$2, money=$3, kills=$4, mob_kills=$5, deaths=$6, play_ticks=$7,
             blocks_mined=$8, quiz_wins=$9, quiz_money=$10, last_seen=COALESCE($11, players.last_seen), updated_at=now()`,
          [r.uuid, r.name, r.money, r.kills, r.mobKills, r.deaths, r.playTicks, r.blocksMined, r.quizWins, r.quizMoney, r.lastSeen],
        ).catch((err) => this.log.warn(`skip ${r.name}: ${err.message}`));
      }
    } catch (err) {
      this.log.error(`sync failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private readJson<T>(path: string): T | null {
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as T;
    } catch {
      return null;
    }
  }

  private readYaml<T>(path: string): T | null {
    try {
      return parse(readFileSync(path, 'utf8')) as T;
    } catch {
      return null;
    }
  }

  private collect(): PlayerRow[] {
    const names = new Map<string, string>();
    for (const e of this.readJson<{ uuid: string; name: string }[]>(join(config.mcDir, 'usercache.json')) ?? []) {
      names.set(e.uuid, e.name);
    }

    const rows = new Map<string, PlayerRow>();
    const row = (uuid: string): PlayerRow => {
      let r = rows.get(uuid);
      if (!r) {
        r = { uuid, name: names.get(uuid) ?? uuid.slice(0, 8), money: 0, kills: 0, mobKills: 0, deaths: 0,
              playTicks: 0, blocksMined: 0, quizWins: 0, quizMoney: 0, lastSeen: null };
        rows.set(uuid, r);
      }
      return r;
    };

    const statsDir = join(config.mcDir, 'world', 'players', 'stats');
    if (existsSync(statsDir)) {
      for (const file of readdirSync(statsDir)) {
        const m = UUID_FILE.exec(file);
        if (!m) continue;
        const stats = this.readJson<{ stats?: Record<string, Record<string, number>> }>(join(statsDir, file))?.stats;
        if (!stats) continue;
        const custom = stats['minecraft:custom'] ?? {};
        const r = row(m[1]);
        r.kills = custom['minecraft:player_kills'] ?? 0;
        r.mobKills = custom['minecraft:mob_kills'] ?? 0;
        r.deaths = custom['minecraft:deaths'] ?? 0;
        r.playTicks = custom['minecraft:play_time'] ?? 0;
        r.blocksMined = Object.values(stats['minecraft:mined'] ?? {}).reduce((a, b) => a + b, 0);
      }
    }

    const userdata = join(config.mcDir, 'plugins', 'Essentials', 'userdata');
    if (existsSync(userdata)) {
      for (const file of readdirSync(userdata)) {
        const m = UUID_FILE.exec(file);
        if (!m) continue;
        const data = this.readYaml<{ money?: string; 'last-account-name'?: string; timestamps?: { login?: number; logout?: number } }>(
          join(userdata, file),
        );
        if (!data) continue;
        const r = row(m[1]);
        r.money = Number(data.money ?? 0) || 0;
        if (data['last-account-name']) r.name = data['last-account-name'];
        const last = Math.max(data.timestamps?.logout ?? 0, data.timestamps?.login ?? 0);
        if (last > 0) r.lastSeen = new Date(last);
      }
    }

    const quiz = this.readYaml<{ players?: Record<string, { name?: string; wins?: number; money?: number }> }>(
      join(config.mcDir, 'plugins', 'CraftQuiz', 'stats.yml'),
    );
    for (const [uuid, q] of Object.entries(quiz?.players ?? {})) {
      const r = row(uuid);
      r.quizWins = q.wins ?? 0;
      r.quizMoney = q.money ?? 0;
      if (q.name && r.name === uuid.slice(0, 8)) r.name = q.name;
    }

    return [...rows.values()];
  }
}
