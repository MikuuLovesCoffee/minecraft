'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { money, number } from '@/lib/format';
import { useI18n } from './I18nProvider';
import { LoginForm } from './LoginForm';
import { PlayerHead } from './PlayerHead';
import { Card } from './Section';
import { TicketList, TicketThread, type Ticket } from './tickets';
import { useSession } from './useSession';

interface Overview {
  players: number;
  openTickets: number;
  tickets: number;
  totalMoney: number;
  quizWins: number;
}

interface Status {
  online: boolean;
  players: { online: number; max: number; sample: string[] };
}

const FILTERS = ['open', 'answered', 'closed', ''] as const;

export function AdminPanel() {
  const { t } = useI18n();
  const { user } = useSession();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('open');
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [o, s, tk] = await Promise.all([
      fetch('/api/admin/overview', { cache: 'no-store' }),
      fetch('/api/status', { cache: 'no-store' }),
      fetch(`/api/admin/tickets${filter ? `?status=${filter}` : ''}`, { cache: 'no-store' }),
    ]);
    if (o.ok) setOverview(await o.json());
    if (s.ok) setStatus(await s.json());
    if (tk.ok) setTickets(await tk.json());
  }, [filter]);

  useEffect(() => {
    if (user?.admin) void load();
  }, [user, load]);

  if (user === undefined) return <Card>…</Card>;
  if (!user) return <Card><LoginForm /></Card>;
  if (!user.admin) return <Card><p className="text-pink">{t.admin.denied}</p></Card>;

  const cards: [string, string, string][] = overview
    ? [
        [t.admin.players, number(overview.players), 'text-diamond'],
        [t.admin.openTickets, number(overview.openTickets), 'text-gold'],
        [t.admin.tickets, number(overview.tickets), 'text-ink'],
        [t.admin.economy, money(overview.totalMoney), 'text-gold'],
        [t.admin.quizWins, number(overview.quizWins), 'text-grass'],
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map(([label, value, color]) => (
          <Card key={label} className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
            <p className={`mt-1 font-pixel text-2xl ${color}`}>{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          {openId !== null ? (
            <TicketThread id={openId} admin onBack={() => setOpenId(null)} onChange={load} />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f || 'all'}
                    onClick={() => setFilter(f)}
                    className={`btn-pixel px-3 py-1.5 text-sm ${filter === f ? 'bg-diamond text-night' : 'bg-night text-ink/80'}`}
                  >
                    {f ? t.help.status[f] : t.admin.all}
                  </button>
                ))}
              </div>
              <TicketList tickets={tickets} onOpen={setOpenId} showPlayer />
            </>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 font-pixel text-lg">
            {t.admin.online} {status && <span className="text-grass">{status.players.online}/{status.players.max}</span>}
          </h3>
          <ul className="space-y-2">
            {status?.players.sample.map((name) => (
              <li key={name}>
                <Link href={`/players/${name}`} className="flex items-center gap-2 text-sm hover:text-diamond">
                  <PlayerHead name={name} size={24} />
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
