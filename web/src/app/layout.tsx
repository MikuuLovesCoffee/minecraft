import type { Metadata } from 'next';
import { Inter, Pixelify_Sans } from 'next/font/google';
import { I18nProvider } from '@/components/I18nProvider';
import { Nav } from '@/components/Nav';
import { dict, getLang } from '@/lib/server';
import './globals.css';

const pixel = Pixelify_Sans({ subsets: ['latin'], variable: '--font-pixelify', weight: ['500', '700'] });
const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'CraftMine SMP', template: '%s · CraftMine SMP' },
  description: "Do'stlar uchun Minecraft server: survival, PvP, viktorina. mc.mikuuloves.coffee",
  metadataBase: new URL('https://mc.mikuuloves.coffee'),
  icons: { icon: '/favicon.svg' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const t = await dict();
  return (
    <html lang={lang} className={`${pixel.variable} ${inter.variable}`}>
      <body className="min-h-screen antialiased">
        <I18nProvider lang={lang}>
          <Nav />
          <main>{children}</main>
          <footer className="mt-24 border-t-2 border-line">
            <div className="ground" aria-hidden />
            <p className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-muted">{t.footer.made}</p>
          </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
