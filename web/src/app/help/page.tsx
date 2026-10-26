import type { Metadata } from 'next';
import { HelpCenter } from '@/components/HelpCenter';
import { Card, Section } from '@/components/Section';
import { dict } from '@/lib/server';

export const metadata: Metadata = { title: 'Yordam' };

export default async function Help() {
  const t = await dict();
  return (
    <>
      <Section title={t.help.title}>
        <HelpCenter />
      </Section>
      <Section title={t.help.faqTitle}>
        <div className="space-y-3">
          {t.help.faq.map(([q, a]) => (
            <Card key={q} className="p-0">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium">
                  {q}
                  <span className="font-pixel text-diamond transition group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="px-5 pb-5 text-sm text-muted">{a}</p>
              </details>
            </Card>
          ))}
        </div>
      </Section>
    </>
  );
}
