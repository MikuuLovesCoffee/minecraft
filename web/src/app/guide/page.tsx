import type { Metadata } from 'next';
import { Card, Section } from '@/components/Section';
import { ALT_ADDRESS, SERVER_ADDRESS } from '@/lib/i18n';
import { dict } from '@/lib/server';

export const metadata: Metadata = { title: "Qo'llanma" };

export default async function Guide() {
  const t = await dict();
  return (
    <>
      <Section title={t.guide.title}>
        <Card>
          <p className="text-lg leading-relaxed text-ink/90">{t.guide.intro}</p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <code className="rounded bg-black/30 px-3 py-1.5 text-diamond">{SERVER_ADDRESS}</code>
            <code className="rounded bg-black/30 px-3 py-1.5 text-muted">{ALT_ADDRESS}</code>
          </div>
        </Card>
      </Section>

      <Section title={t.home.joinTitle}>
        <ol className="grid gap-4 md:grid-cols-3">
          {t.home.steps.map(([title, body], i) => (
            <li key={title}>
              <Card className="h-full">
                <span className="font-pixel text-3xl text-grass">{i + 1}</span>
                <h3 className="mt-2 font-pixel text-lg">{title}</h3>
                <p className="mt-2 text-sm text-muted">{body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={t.guide.rulesTitle} id="rules">
        <Card>
          <ul className="space-y-3">
            {t.guide.rules.map((rule) => (
              <li key={rule} className="flex gap-3">
                <span className="mt-1.5 inline-block h-2 w-2 shrink-0 bg-pink" aria-hidden />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Section title={t.guide.commandsTitle} id="commands">
        <div className="grid gap-4 md:grid-cols-2">
          {t.guide.groups.map(([group, commands]) => (
            <Card key={group}>
              <h3 className="mb-3 font-pixel text-lg text-gold">{group}</h3>
              <dl className="divide-y divide-line">
                {commands.map(([cmd, desc]) => (
                  <div key={cmd} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <dt>
                      <code className="text-sm text-diamond">{cmd}</code>
                    </dt>
                    <dd className="text-sm text-muted sm:text-right">{desc}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
