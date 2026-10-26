import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';
import { config } from './config';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  uuid        text PRIMARY KEY,
  name        text NOT NULL,
  money       numeric(20, 2) NOT NULL DEFAULT 0,
  kills       integer NOT NULL DEFAULT 0,
  mob_kills   integer NOT NULL DEFAULT 0,
  deaths      integer NOT NULL DEFAULT 0,
  play_ticks  bigint NOT NULL DEFAULT 0,
  blocks_mined integer NOT NULL DEFAULT 0,
  quiz_wins   integer NOT NULL DEFAULT 0,
  quiz_money  bigint NOT NULL DEFAULT 0,
  last_seen   timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS players_name_lower ON players (lower(name));

CREATE TABLE IF NOT EXISTS tickets (
  id          serial PRIMARY KEY,
  player_name text NOT NULL,
  category    text NOT NULL,
  subject     text NOT NULL,
  status      text NOT NULL DEFAULT 'open',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tickets_player ON tickets (lower(player_name));

CREATE TABLE IF NOT EXISTS ticket_messages (
  id          serial PRIMARY KEY,
  ticket_id   integer NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  is_admin    boolean NOT NULL DEFAULT false,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
`;

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({ connectionString: config.databaseUrl, max: 5 });

  async onModuleInit() {
    await this.pool.query(SCHEMA);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query<T>(sql, params);
    return result.rows;
  }
}
