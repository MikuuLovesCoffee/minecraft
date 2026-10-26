'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from './I18nProvider';
import { PlayerHead } from './PlayerHead';
import { useSession } from './useSession';

export function Nav() {
  const { t, lang } = useI18n();
  const { user, logout } = useSession();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Close the mobile menu after any navigation or login/logout
  useEffect(() => setOpen(false), [path, user]);

  const links = [
    ['/', t.nav.home],
    ['/guide', t.nav.guide],
    ['/leaderboard', t.nav.leaderboard],
    ['/players', t.nav.players],
    ['/help', t.nav.help],
    ...(user?.admin ? [['/admin', t.nav.admin]] : []),
  ];

  const switchLang = () => {
    document.cookie = `lang=${lang === 'uz' ? 'en' : 'uz'}; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b-2 border-line bg-night/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-pixel text-xl tracking-wide">
          <span className="inline-block h-6 w-6 bg-grass shadow-[inset_0_-10px_0_0_var(--color-dirt)]" aria-hidden />
          Craft<span className="text-diamond">Mine</span>
        </Link>

        <button
          className="ml-auto rounded px-2 py-1 font-pixel text-muted md:hidden"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Menu"
        >
          ☰
        </button>

        <div className={`${open ? 'flex' : 'hidden'} absolute inset-x-0 top-full flex-col gap-1 border-b-2 border-line bg-night px-4 pb-4 md:static md:ml-auto md:flex md:flex-row md:items-center md:gap-1 md:border-0 md:bg-transparent md:p-0`}>
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`rounded px-3 py-2 text-sm font-medium transition hover:bg-white/5 ${path === href ? 'text-diamond' : 'text-ink/80'}`}
            >
              {label}
            </Link>
          ))}
          <button onClick={switchLang} className="rounded px-3 py-2 font-pixel text-sm text-gold hover:bg-white/5" aria-label="Language">
            {lang === 'uz' ? 'EN' : 'UZ'}
          </button>
          {user ? (
            <div className="flex items-center gap-2 px-2">
              <PlayerHead name={user.name} size={24} />
              <span className="text-sm">{user.name}</span>
              <button onClick={logout} className="text-xs text-muted hover:text-ink">
                {t.nav.logout}
              </button>
            </div>
          ) : (
            <Link href="/help#login" onClick={() => setOpen(false)} className="btn-pixel ml-1 self-start bg-grass px-3 py-1.5 text-sm text-white md:self-auto">
              {t.nav.login}
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
