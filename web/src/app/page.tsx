import Link from 'next/link';
import { HeroSceneLazy } from '@/components/HeroSceneLazy';
import { PlayerHead } from '@/components/PlayerHead';
import { Card, Section } from '@/components/Section';
import { ServerAddress } from '@/components/ServerAddress';
import { money } from '@/lib/format';
import { api, dict, type Player } from '@/lib/server';

const WORLD_COLORS = ['bg-grass', 'bg-diamond', 'bg-pink', 'bg-gold'];
const FEATURE_ICONS = ['❓', '🪓', '💰', '🛡️', '🏠', '🎨'];

export default async function Home() {
  const t = await dict();
  const top = (await api<Player[]>('/leaderboard/money', 60))?.slice(0, 5) ?? [];

  return (
    <>
      {/* Hero */}
      <section className="sky relative overflow-hidden">
        <div className="stars absolute inset-0" aria-hidden />
        <div className="cloud left-0 top-16 opacity-80" style={{ animationDuration: '70s' }} aria-hidden />
        <div className="cloud left-0 top-36 scale-75 opacity-60" style={{ animationDuration: '95s', animationDelay: '-40s' }} aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-4 pb-0 pt-10 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <h1 className="font-pixel text-5xl leading-none drop-shadow-[0_4px_0_rgba(0,0,0,0.45)] sm:text-7xl">
              Craft<span className="text-diamond">Mine</span>
              <span className="mt-2 block text-3xl text-pink sm:text-4xl">SMP</span>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-lg text-ink/90 lg:mx-0">{t.hero.tagline}</p>
            <div className="mt-8 flex justify-center lg:justify-start">
              <ServerAddress />
            </div>
            <p className="mt-4 text-xs text-ink/70">{t.hero.version}</p>
          </div>
          <HeroSceneLazy />
        </div>
        <div className="ground relative" aria-hidden />
      </section>

      {/* How to join */}
      <Section title={t.home.joinTitle}>
        <div className="grid gap-4 md:grid-cols-3">
          {t.home.steps.map(([title, body], i) => (
            <Card key={title}>
              <div className="mb-3 flex h-10 w-10 items-center justify-center bg-grass font-pixel text-xl text-white shadow-[inset_0_-4px_0_0_rgba(0,0,0,0.25)]">
                {i + 1}
              </div>
              <h3 className="font-pixel text-lg">{title}</h3>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Worlds */}
      <Section title={t.home.worldsTitle}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.home.worlds.map(([name, body, cmd], i) => (
            <Card key={name} className="flex flex-col">
              <div className={`mb-4 h-2 w-12 ${WORLD_COLORS[i]}`} />
              <h3 className="font-pixel text-xl">{name}</h3>
              <p className="mt-2 flex-1 text-sm text-muted">{body}</p>
              <code className="mt-4 self-start rounded bg-black/30 px-2 py-1 text-sm text-gold">{cmd}</code>
            </Card>
          ))}
        </div>
      </Section>

      {/* Features */}
      <Section title={t.home.featuresTitle}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.home.features.map(([title, body], i) => (
            <Card key={title} className="flex gap-4">
              <span className="text-3xl" aria-hidden>
                {FEATURE_ICONS[i]}
              </span>
              <div>
                <h3 className="font-pixel text-lg">{title}</h3>
                <p className="mt-1 text-sm text-muted">{body}</p>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* Top players */}
      <Section title={t.home.topTitle}>
        <Card>
          {top.length === 0 ? (
            <p className="text-muted">{t.board.empty}</p>
          ) : (
            <ol className="divide-y divide-line">
              {top.map((p, i) => (
                <li key={p.name}>
                  <Link href={`/players/${p.name}`} className="flex items-center gap-4 py-3 transition hover:bg-white/5">
                    <span className={`w-6 font-pixel text-lg ${i === 0 ? 'text-gold' : 'text-muted'}`}>{i + 1}</span>
                    <PlayerHead name={p.name} size={32} />
                    <span className="flex-1 font-medium">{p.name}</span>
                    <span className="font-pixel text-gold">{money(p.money)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
          <Link href="/leaderboard" className="mt-4 inline-block text-sm text-diamond hover:underline">
            {t.home.seeAll} →
          </Link>
        </Card>
      </Section>
    </>
  );
}
