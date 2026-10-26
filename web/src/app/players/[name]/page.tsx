import { notFound } from 'next/navigation';
import { SkinViewerLazy } from '@/components/HeroSceneLazy';
import { Card, Section } from '@/components/Section';
import { date, money, number, playtime } from '@/lib/format';
import { api, dict, getLang, type Player } from '@/lib/server';

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  return { title: (await params).name };
}

export default async function PlayerPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) notFound();
  const player = await api<Player>(`/players/${name}`, 60);
  if (!player) notFound();
  const t = await dict();
  const lang = await getLang();

  const stats: [string, string, string][] = [
    [t.stats.money, money(player.money), 'text-gold'],
    [t.stats.playtime, playtime(player.playTicks), 'text-diamond'],
    [t.stats.kills, number(player.kills), 'text-pink'],
    [t.stats.mobKills, number(player.mobKills), 'text-ink'],
    [t.stats.deaths, number(player.deaths), 'text-ink'],
    [t.stats.mined, number(player.blocksMined), 'text-ink'],
    [t.stats.quizWins, number(player.quizWins), 'text-grass'],
  ];

  return (
    <Section>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="sky overflow-hidden p-0">
          <SkinViewerLazy name={player.name} />
        </Card>
        <div>
          <h1 className="font-pixel text-4xl">{player.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {t.players.lastSeen}: {date(player.lastSeen, lang)}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.map(([label, value, color]) => (
              <Card key={label} className="p-4">
                <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
                <p className={`mt-1 font-pixel text-2xl ${color}`}>{value}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
