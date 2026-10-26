import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { config } from '../config';

export interface Skin {
  png: Buffer;
  slim: boolean;
}

const NAME = /^[A-Za-z0-9_]{1,16}$/;
const SKIN_HOSTS = ['textures.minecraft.net'];
const SR_SUFFIX: Record<string, string> = {
  CUSTOM: 'customskin',
  PLAYER: 'playerskin',
  URL: 'urlskin',
  LEGACY: 'legacyskin',
};

/**
 * Resolves a player's skin: the bundled custom (HD) skins, then their SkinsRestorer choice,
 * then the Mojang skin for premium names, then a default skin.
 */
@Injectable()
export class SkinsService {
  private readonly log = new Logger(SkinsService.name);
  private readonly cache = new Map<string, { at: number; skin: Skin }>();
  private readonly srDir = join(config.mcDir, 'plugins', 'SkinsRestorer');
  private readonly customDir = process.env.SKINS_DIR ?? join(__dirname, '..', '..', 'skins');

  async get(name: string): Promise<Skin | null> {
    if (!NAME.test(name)) return null;
    const key = name.toLowerCase();
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.skin;

    // Bundled HD skins win over the 64x64 in-game choice, so the owners always look HD on the site.
    const skin =
      this.fromCustom(key) ??
      (await this.fromSkinsRestorer(name)) ??
      (await this.fromMojang(name)) ??
      (await this.download('https://mc-heads.net/skin/MHF_Steve', false, true));
    if (skin) this.cache.set(key, { at: Date.now(), skin });
    return skin;
  }

  private readJson(path: string): any {
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      return null;
    }
  }

  private offlineUuid(name: string): string {
    // Same UUID the server gives an offline-mode player: md5("OfflinePlayer:<name>") as a v3 UUID
    const h = createHash('md5').update(`OfflinePlayer:${name}`).digest();
    h[6] = (h[6] & 0x0f) | 0x30;
    h[8] = (h[8] & 0x3f) | 0x80;
    const hex = h.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  private async fromSkinsRestorer(name: string): Promise<Skin | null> {
    const player = this.readJson(join(this.srDir, 'players', `${this.offlineUuid(name)}.player`));
    const id = player?.skinIdentifier ?? player;
    if (!id?.identifier || !id?.skinType) return null;
    const suffix = SR_SUFFIX[String(id.skinType).toUpperCase()];
    if (!suffix) return null;
    const file = id.skinType === 'URL' ? `${id.identifier}_${id.skinVariant ?? 'CLASSIC'}` : id.identifier;
    const data = this.readJson(join(this.srDir, 'skins', `${file}.${suffix}`));
    return data?.value ? this.fromTextureValue(data.value) : null;
  }

  private fromCustom(key: string): Skin | null {
    const path = join(this.customDir, `${key}.png`);
    if (!existsSync(path)) return null;
    return { png: readFileSync(path), slim: key === 'xxbabyxv' };
  }

  private async fromMojang(name: string): Promise<Skin | null> {
    try {
      const profile = await fetch(`https://api.mojang.com/users/profiles/minecraft/${name}`, { signal: AbortSignal.timeout(5000) });
      if (!profile.ok) return null;
      const { id } = (await profile.json()) as { id: string };
      const session = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${id}`, { signal: AbortSignal.timeout(5000) });
      if (!session.ok) return null;
      const { properties } = (await session.json()) as { properties: { name: string; value: string }[] };
      const textures = properties.find((p) => p.name === 'textures');
      return textures ? this.fromTextureValue(textures.value) : null;
    } catch {
      return null;
    }
  }

  private async fromTextureValue(value: string): Promise<Skin | null> {
    try {
      const decoded = JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
      const skin = decoded?.textures?.SKIN;
      if (!skin?.url) return null;
      return this.download(skin.url, skin.metadata?.model === 'slim');
    } catch {
      return null;
    }
  }

  private async download(url: string, slim: boolean, trusted = false): Promise<Skin | null> {
    try {
      const u = new URL(url.replace(/^http:/, 'https:'));
      // Only fetch from Mojang's texture CDN (plus the fixed default) so a crafted skin value can't make us fetch arbitrary URLs.
      if (!trusted && !SKIN_HOSTS.includes(u.hostname)) return null;
      const res = await fetch(u, { signal: AbortSignal.timeout(5000) });
      if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/png')) return null;
      const png = Buffer.from(await res.arrayBuffer());
      return png.length < 256 * 1024 ? { png, slim } : null;
    } catch (err) {
      this.log.warn(`skin download failed: ${(err as Error).message}`);
      return null;
    }
  }
}
