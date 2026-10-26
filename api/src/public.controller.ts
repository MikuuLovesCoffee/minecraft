import { BadRequestException, Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { DbService } from './db.service';
import { SkinsService } from './minecraft/skins.service';
import { StatusService } from './minecraft/status.service';

const BOARDS: Record<string, string> = {
  money: 'money',
  kills: 'kills',
  deaths: 'deaths',
  playtime: 'play_ticks',
  quiz: 'quiz_wins',
  mined: 'blocks_mined',
};

// bigint/numeric columns are cast so pg returns JSON numbers instead of strings
const PLAYER_COLUMNS = `name, money::float AS money, kills, mob_kills AS "mobKills", deaths, play_ticks::float AS "playTicks",
  blocks_mined AS "blocksMined", quiz_wins AS "quizWins", quiz_money::float AS "quizMoney", last_seen AS "lastSeen"`;

@Controller()
export class PublicController {
  constructor(
    private readonly db: DbService,
    private readonly status: StatusService,
    private readonly skins: SkinsService,
  ) {}

  @Get('status')
  getStatus() {
    return this.status.get();
  }

  @Get('leaderboard/:board')
  async leaderboard(@Param('board') board: string) {
    const column = BOARDS[board];
    if (!column) throw new BadRequestException('Unknown leaderboard');
    // column comes from the whitelist above, never from user input
    return this.db.query(`SELECT ${PLAYER_COLUMNS} FROM players ORDER BY ${column} DESC, name ASC LIMIT 20`);
  }

  @Get('players')
  async players(@Query('q') q?: string) {
    const search = (q ?? '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
    return this.db.query(
      `SELECT ${PLAYER_COLUMNS} FROM players WHERE name ILIKE $1 ORDER BY last_seen DESC NULLS LAST LIMIT 100`,
      [`%${search}%`],
    );
  }

  @Get('players/:name')
  async player(@Param('name') name: string) {
    if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) throw new NotFoundException();
    const [row] = await this.db.query(`SELECT ${PLAYER_COLUMNS} FROM players WHERE lower(name) = lower($1)`, [name]);
    if (!row) throw new NotFoundException();
    return row;
  }

  @Get('skins/:name')
  async skin(@Param('name') name: string, @Res() res: Response) {
    const skin = await this.skins.get(name.replace(/\.png$/, ''));
    if (!skin) throw new NotFoundException();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.setHeader('X-Skin-Model', skin.slim ? 'slim' : 'default');
    res.send(skin.png);
  }
}
