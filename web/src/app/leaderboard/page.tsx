import type { Metadata } from 'next';
import Link from 'next/link';
import { PlayerHead } from '@/components/PlayerHead';
import { Card, Section } from '@/components/Section';
import { money, number, playtime } from '@/lib/format';
import { api, dict, type Player } from '@/lib/server';

export const metadata: Metadata = { title: 'Reyting' };

const BOARDS = ['money', 'kills', 'quiz', 'playtime', 'mined', 'deaths'] as const;
type Board = (typeof BOARDS)[number];

function value(board: Board, p: Player): string {
  switch (board) {
    case 'money': return money(p.money);
    case 'kills': return number(p.kills);
    case 'quiz': return number(p.quizWins);
    case 'playtime': return playtime(p.playTicks);
    case 'mined': return number(p.blocksMined);
    case 'deaths': return number(p.deaths);
  }
}

const MEDALS = ['text-gold', 'text-[#d6d6e7]', 'text-[#e3a06a]'];

export default async function Leaderboard({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const t = await dict();
  const requested = (await searchParams).b;
  const board: Board = BOARDS.includes(requested as Board) ? (requested as Board) : 'money';
  const rows = (await api<Player[]>(`/leaderboard/${board}`, 60)) ?? [];

  return (
    <Section title={t.board.title}>
      <div className="mb-6 flex flex-wrap gap-2" role="tablist">
        {BOARDS.map((b) => (
          <Link
            key={b}
            href={`/leaderboard?b=${b}`}
            role="tab"
            aria-selected={b === board}
            className={`btn-pixel px-4 py-2 text-sm ${b === board ? 'bg-diamond text-night' : 'bg-panel text-ink/80'}`}
          >
            {t.board.tabs[b]}
          </Link>
        ))}
      </div>

      <Card className="p-0">
        {rows.length === 0 ? (
          <p className="p-6 text-muted">{t.board.empty}</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-line text-xs uppercase tracking-wider text-muted">
                <th className="w-14 px-4 py-3">#</th>
                <th className="px-4 py-3">{t.board.player}</th>
                <th className="px-4 py-3 text-right">{t.board.tabs[board]}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={p.name} className="border-b border-line/60 last:border-0 hover:bg-white/5">
                  <td className={`px-4 py-3 font-pixel text-lg ${MEDALS[i] ?? 'text-muted'}`}>{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link href={`/players/${p.name}`} className="flex items-center gap-3 hover:text-diamond">
                      <PlayerHead name={p.name} size={28} />
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-pixel text-gold">{value(board, p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">{t.board.updated}</p>
    </Section>
  );
}
