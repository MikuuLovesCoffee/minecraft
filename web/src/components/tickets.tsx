'use client';

import { useCallback, useEffect, useState } from 'react';
import { date } from '@/lib/format';
import { useI18n } from './I18nProvider';
import { PlayerHead } from './PlayerHead';

export interface Ticket {
  id: number;
  playerName: string;
  category: string;
  subject: string;
  status: 'open' | 'answered' | 'closed';
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: number;
  authorName: string;
  isAdmin: boolean;
  body: string;
  createdAt: string;
}

export const inputClass =
  'w-full rounded-md border-2 border-line bg-night px-3 py-2.5 outline-none transition focus:border-diamond disabled:opacity-60';

const STATUS_STYLE: Record<Ticket['status'], string> = {
  open: 'bg-gold/15 text-gold',
  answered: 'bg-diamond/15 text-diamond',
  closed: 'bg-white/10 text-muted',
};

export function StatusBadge({ status }: { status: Ticket['status'] }) {
  const { t } = useI18n();
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{t.help.status[status]}</span>;
}

export async function postJson(url: string, body: unknown, method = 'POST') {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw Object.assign(new Error('request failed'), { status: res.status });
  return res.json();
}

export function TicketList({ tickets, onOpen, showPlayer = false }: { tickets: Ticket[]; onOpen: (id: number) => void; showPlayer?: boolean }) {
  const { t, lang } = useI18n();
  if (tickets.length === 0) return <p className="text-sm text-muted">{t.help.none}</p>;
  return (
    <ul className="divide-y divide-line">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <button onClick={() => onOpen(ticket.id)} className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-white/5">
            {showPlayer && <PlayerHead name={ticket.playerName} size={28} />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                <span className="text-muted">#{ticket.id}</span> {ticket.subject}
              </p>
              <p className="text-xs text-muted">
                {showPlayer && `${ticket.playerName} · `}
                {t.help.categories[ticket.category as keyof typeof t.help.categories] ?? ticket.category} · {date(ticket.updatedAt, lang)}
              </p>
            </div>
            <StatusBadge status={ticket.status} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Conversation view for one ticket; admins also get status controls. */
export function TicketThread({ id, admin, onBack, onChange }: { id: number; admin: boolean; onBack: () => void; onChange?: () => void }) {
  const { t, lang } = useI18n();
  const [ticket, setTicket] = useState<(Ticket & { messages: Message[] }) | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/tickets/${id}`, { cache: 'no-store' });
    if (res.ok) setTicket(await res.json());
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await postJson(`/api/tickets/${id}/messages`, { message: reply });
      setReply('');
      await load();
      onChange?.();
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: string) => {
    await postJson(`/api/admin/tickets/${id}`, { status }, 'PATCH');
    await load();
    onChange?.();
  };

  if (!ticket) return <p className="text-muted">…</p>;
  const closed = ticket.status === 'closed';

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-diamond hover:underline">
        ← {t.help.back}
      </button>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h3 className="font-pixel text-xl">
          #{ticket.id} {ticket.subject}
        </h3>
        <StatusBadge status={ticket.status} />
        {admin && (
          <select
            value={ticket.status}
            onChange={(e) => setStatus(e.target.value)}
            className="ml-auto rounded border-2 border-line bg-night px-2 py-1 text-sm"
            aria-label={t.admin.setStatus}
          >
            {(['open', 'answered', 'closed'] as const).map((s) => (
              <option key={s} value={s}>
                {t.help.status[s]}
              </option>
            ))}
          </select>
        )}
      </div>

      <ol className="space-y-3">
        {ticket.messages.map((m) => (
          <li key={m.id} className={`flex gap-3 ${m.isAdmin ? 'flex-row-reverse text-right' : ''}`}>
            <PlayerHead name={m.authorName} size={32} />
            <div className={`max-w-[80%] rounded-md border-2 px-4 py-3 ${m.isAdmin ? 'border-diamond/40 bg-diamond/10' : 'border-line bg-night'}`}>
              <p className="mb-1 text-xs text-muted">
                {m.authorName}
                {m.isAdmin && <span className="ml-2 rounded bg-diamond/20 px-1.5 text-diamond">{t.help.adminTag}</span>} · {date(m.createdAt, lang)}
              </p>
              {/* Rendered as text, never as HTML */}
              <p className="whitespace-pre-wrap break-words text-left text-sm">{m.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {closed && !admin ? (
        <p className="mt-4 text-sm text-muted">{t.help.closedNote}</p>
      ) : (
        <form onSubmit={send} className="mt-5 flex flex-col gap-3">
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={4000} className={inputClass} placeholder={t.help.reply} />
          <button disabled={busy || !reply.trim()} className="btn-pixel self-end bg-diamond px-5 py-2 text-night disabled:opacity-50">
            {t.help.send}
          </button>
        </form>
      )}
    </div>
  );
}
