'use client';

import { useCallback, useEffect, useState } from 'react';

export interface SessionUser {
  name: string;
  admin: boolean;
}

/** Current website login (cookie-based); `undefined` while loading, `null` when logged out. */
export function useSession() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      setUser(res.ok ? ((await res.json()) as { user: SessionUser | null }).user : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener('session-change', onChange);
    return () => window.removeEventListener('session-change', onChange);
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.dispatchEvent(new Event('session-change'));
  }, []);

  return { user, refresh, logout };
}
