import type { Metadata } from 'next';
import { AdminPanel } from '@/components/AdminPanel';
import { Section } from '@/components/Section';
import { dict } from '@/lib/server';

export const metadata: Metadata = { title: 'Admin', robots: { index: false } };

export default async function Admin() {
  const t = await dict();
  return (
    <Section title={t.admin.title}>
      <AdminPanel />
    </Section>
  );
}
