import type { Metadata } from 'next';
import Link from 'next/link';
import { PlayerHead } from '@/components/PlayerHead';
import { Section } from '@/components/Section';
import { date, money } from '@/lib/format';
import { api, dict, getLang, type Player } from '@/lib/server';

export const metadata: Metadata = { title: "O'yinchilar" };

export default async function Players({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const t = await dict();
  const lang = await getLang();
  const q = ((await searchParams).q ?? '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
  const players = (await api<Player[]>(`/players?q=${encodeURIComponent(q)}`, 60)) ?? [];

  return (
    <Section title={t.players.title}>
      <form className="mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder={t.players.search}
          maxLength={16}
          className="w-full max-w-sm rounded-md border-2 border-line bg-panel px-4 py-2.5 outline-none focus:border-diamond"
        />
      </form>
      {players.length === 0 ? (
        <p className="text-muted">{t.players.notFound}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => (
            <Link key={p.name} href={`/players/${p.name}`} className="pixel-frame flex items-center gap-4 rounded-md bg-panel p-4 transition hover:-translate-y-0.5 hover:border-diamond">
              <PlayerHead name={p.name} size={44} />
              <div className="min-w-0">
                <p className="truncate font-pixel text-lg">{p.name}</p>
                <p className="text-xs text-muted">
                  <span className="text-gold">{money(p.money)}</span> · {t.players.lastSeen}: {date(p.lastSeen, lang)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}
