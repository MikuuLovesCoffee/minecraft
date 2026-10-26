import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsString, Length } from 'class-validator';
import { AdminGuard, AuthGuard, CurrentUser } from './auth/auth.guard';
import { SessionUser } from './auth/auth.service';
import { DbService } from './db.service';

const CATEGORIES = ['question', 'bug', 'report', 'lost-items', 'other'];
const STATUSES = ['open', 'answered', 'closed'];

class CreateTicketDto {
  @IsIn(CATEGORIES)
  category: string;

  @IsString()
  @Length(3, 120)
  subject: string;

  @IsString()
  @Length(5, 4000)
  message: string;
}

class ReplyDto {
  @IsString()
  @Length(1, 4000)
  message: string;
}

class StatusDto {
  @IsIn(STATUSES)
  status: string;
}

const TICKET_COLUMNS = `id, player_name AS "playerName", category, subject, status, created_at AS "createdAt", updated_at AS "updatedAt"`;

@Controller()
export class TicketsController {
  constructor(private readonly db: DbService) {}

  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @Post('tickets')
  async create(@CurrentUser() user: SessionUser, @Body() dto: CreateTicketDto) {
    const [ticket] = await this.db.query<{ id: number }>(
      `INSERT INTO tickets (player_name, category, subject) VALUES ($1, $2, $3) RETURNING id`,
      [user.name, dto.category, dto.subject.trim()],
    );
    await this.db.query(`INSERT INTO ticket_messages (ticket_id, author_name, is_admin, body) VALUES ($1, $2, $3, $4)`, [
      ticket.id, user.name, user.admin, dto.message.trim(),
    ]);
    return ticket;
  }

  @UseGuards(AuthGuard)
  @Get('tickets/mine')
  mine(@CurrentUser() user: SessionUser) {
    return this.db.query(`SELECT ${TICKET_COLUMNS} FROM tickets WHERE lower(player_name) = lower($1) ORDER BY updated_at DESC`, [user.name]);
  }

  @UseGuards(AuthGuard)
  @Get('tickets/:id')
  async one(@CurrentUser() user: SessionUser, @Param('id', ParseIntPipe) id: number) {
    const ticket = await this.owned(user, id);
    const messages = await this.db.query(
      `SELECT id, author_name AS "authorName", is_admin AS "isAdmin", body, created_at AS "createdAt"
       FROM ticket_messages WHERE ticket_id = $1 ORDER BY created_at`,
      [id],
    );
    return { ...ticket, messages };
  }

  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 20, ttl: 10 * 60_000 } })
  @Post('tickets/:id/messages')
  async reply(@CurrentUser() user: SessionUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ReplyDto) {
    const ticket = await this.owned(user, id);
    if (ticket.status === 'closed' && !user.admin) throw new ForbiddenException('Ticket is closed');
    await this.db.query(`INSERT INTO ticket_messages (ticket_id, author_name, is_admin, body) VALUES ($1, $2, $3, $4)`, [
      id, user.name, user.admin, dto.message.trim(),
    ]);
    // An admin reply marks the ticket answered; a player reply reopens it.
    await this.db.query(`UPDATE tickets SET status = $2, updated_at = now() WHERE id = $1`, [id, user.admin ? 'answered' : 'open']);
    return { ok: true };
  }

  @UseGuards(AdminGuard)
  @Get('admin/tickets')
  all(@Query('status') status?: string) {
    if (status && STATUSES.includes(status)) {
      return this.db.query(`SELECT ${TICKET_COLUMNS} FROM tickets WHERE status = $1 ORDER BY updated_at DESC LIMIT 200`, [status]);
    }
    return this.db.query(`SELECT ${TICKET_COLUMNS} FROM tickets ORDER BY updated_at DESC LIMIT 200`);
  }

  @UseGuards(AdminGuard)
  @Patch('admin/tickets/:id')
  async setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: StatusDto) {
    await this.db.query(`UPDATE tickets SET status = $2, updated_at = now() WHERE id = $1`, [id, dto.status]);
    return { ok: true };
  }

  @UseGuards(AdminGuard)
  @Get('admin/overview')
  async overview() {
    const [counts] = await this.db.query(
      `SELECT (SELECT count(*) FROM players)::int AS players,
              (SELECT count(*) FROM tickets WHERE status = 'open')::int AS "openTickets",
              (SELECT count(*) FROM tickets)::int AS tickets,
              (SELECT coalesce(sum(money), 0) FROM players)::float AS "totalMoney",
              (SELECT coalesce(sum(quiz_wins), 0) FROM players)::int AS "quizWins"`,
    );
    return counts;
  }

  private async owned(user: SessionUser, id: number) {
    const [ticket] = await this.db.query<{ playerName: string; status: string }>(`SELECT ${TICKET_COLUMNS} FROM tickets WHERE id = $1`, [id]);
    // Players only see their own tickets; a 404 (not 403) avoids revealing which ids exist.
    if (!ticket || (!user.admin && ticket.playerName.toLowerCase() !== user.name.toLowerCase())) throw new NotFoundException();
    return ticket;
  }
}
