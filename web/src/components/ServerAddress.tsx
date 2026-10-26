'use client';

import { useEffect, useState } from 'react';
import { ALT_ADDRESS, SERVER_ADDRESS } from '@/lib/i18n';
import { useI18n } from './I18nProvider';

interface Status {
  online: boolean;
  players: { online: number; max: number };
}

export function ServerAddress() {
  const { t } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/status')
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => alive && setStatus(s))
        .catch(() => {});
    load();
    const id = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard blocked: the address is still visible to copy by hand */
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={() => copy(SERVER_ADDRESS)}
        className="btn-pixel group flex items-center gap-3 bg-grass px-5 py-3 text-lg text-white sm:text-xl"
      >
        <span>{SERVER_ADDRESS}</span>
        <span className="rounded bg-black/25 px-2 py-0.5 text-xs">{copied === SERVER_ADDRESS ? t.hero.copied : t.hero.copy}</span>
      </button>

      <div className="flex items-center gap-2 text-sm">
        {status === null ? (
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-muted" />
        ) : status.online ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-grass opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-grass" />
            </span>
            <span className="font-pixel text-base">
              {status.players.online}/{status.players.max}
            </span>
            <span className="text-muted">{t.hero.online}</span>
          </>
        ) : (
          <span className="text-pink">{t.hero.offline}</span>
        )}
      </div>

      <p className="text-xs text-muted">
        {t.hero.altHint}{' '}
        <button onClick={() => copy(ALT_ADDRESS)} className="font-mono text-ink underline decoration-dotted underline-offset-4">
          {copied === ALT_ADDRESS ? t.hero.copied : ALT_ADDRESS}
        </button>
      </p>
    </div>
  );
}
