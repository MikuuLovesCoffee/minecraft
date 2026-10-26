import { Injectable, UnauthorizedException } from '@nestjs/common';
import Database from 'better-sqlite3';
import { createHash, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import { join } from 'path';
import { config } from '../config';

export interface SessionUser {
  name: string;
  admin: boolean;
}

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

/** Website login with the same password players registered in-game (AuthMe, read-only). */
@Injectable()
export class AuthService {
  private readonly dbPath = join(config.mcDir, 'plugins', 'AuthMe', 'authme.db');

  verify(name: string, password: string): SessionUser {
    const db = new Database(this.dbPath, { readonly: true, fileMustExist: true });
    try {
      const row = db
        .prepare('SELECT realname, password FROM authme WHERE username = ?')
        .get(name.toLowerCase()) as { realname: string; password: string } | undefined;
      // Always hash something so a missing user takes as long as a wrong password.
      const stored = row?.password ?? '$SHA$0000000000000000$' + '0'.repeat(64);
      if (!this.matches(password, stored) || !row) {
        throw new UnauthorizedException('Wrong name or password');
      }
      return { name: row.realname, admin: config.admins.includes(row.realname.toLowerCase()) };
    } finally {
      db.close();
    }
  }

  /** AuthMe SHA256 format: $SHA$<salt>$<sha256(sha256(password) + salt)> */
  private matches(password: string, stored: string): boolean {
    const parts = stored.split('$');
    if (parts.length !== 4 || parts[1] !== 'SHA') return false;
    const expected = Buffer.from(parts[3], 'hex');
    const actual = Buffer.from(sha256(sha256(password) + parts[2]), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  sign(user: SessionUser): string {
    return jwt.sign({ sub: user.name, adm: user.admin }, config.jwtSecret, { expiresIn: '7d', algorithm: 'HS256' });
  }

  read(token: string | undefined): SessionUser | null {
    if (!token) return null;
    try {
      const p = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as { sub: string; adm: boolean };
      // Admin rights come from the current config, not just the token, so removing an admin takes effect immediately.
      return { name: p.sub, admin: config.admins.includes(p.sub.toLowerCase()) };
    } catch {
      return null;
    }
  }
}
