'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from './I18nProvider';
import { LoginForm } from './LoginForm';
import { Card } from './Section';
import { inputClass, postJson, TicketList, TicketThread, type Ticket } from './tickets';
import { useSession } from './useSession';

const CATEGORIES = ['question', 'bug', 'report', 'lost-items', 'other'] as const;

export function HelpCenter() {
  const { t } = useI18n();
  const { user } = useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [form, setForm] = useState({ category: 'question', subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/tickets/mine', { cache: 'no-store' });
    if (res.ok) setTickets(await res.json());
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { id } = await postJson('/api/tickets', form);
      setForm({ category: 'question', subject: '', message: '' });
      await load();
      setOpenId(id);
    } catch (err) {
      setError((err as { status?: number }).status === 429 ? t.help.tooMany : '⚠');
    } finally {
      setBusy(false);
    }
  };

  if (user === undefined) return <Card>…</Card>;
  if (!user) return <Card><LoginForm /></Card>;

  if (openId !== null) {
    return (
      <Card>
        <TicketThread id={openId} admin={user.admin} onBack={() => setOpenId(null)} onChange={load} />
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h3 className="mb-4 font-pixel text-xl">{t.help.newTicket}</h3>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="text-sm">
            {t.help.category}
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`${inputClass} mt-1`}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t.help.categories[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {t.help.subject}
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} minLength={3} maxLength={120} required className={`${inputClass} mt-1`} />
          </label>
          <label className="text-sm">
            {t.help.message}
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} minLength={5} maxLength={4000} rows={5} required className={`${inputClass} mt-1`} />
          </label>
          {error && <p className="text-sm text-pink">{error}</p>}
          <button disabled={busy} className="btn-pixel self-start bg-grass px-5 py-2.5 text-white disabled:opacity-60">
            {t.help.send}
          </button>
        </form>
      </Card>
      <Card>
        <h3 className="mb-2 font-pixel text-xl">{t.help.myTickets}</h3>
        <TicketList tickets={tickets} onOpen={setOpenId} />
      </Card>
    </div>
  );
}
