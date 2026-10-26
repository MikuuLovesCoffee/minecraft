'use client';

import { useState } from 'react';
import { useI18n } from './I18nProvider';
import { inputClass, postJson } from './tickets';

export function LoginForm() {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await postJson('/api/auth/login', { name, password });
      setPassword('');
      window.dispatchEvent(new Event('session-change'));
    } catch (err) {
      setError((err as { status?: number }).status === 429 ? t.help.tooMany : t.help.wrong);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex max-w-sm flex-col gap-3" id="login">
      <h3 className="font-pixel text-xl">{t.help.loginTitle}</h3>
      <p className="text-sm text-muted">{t.help.loginHint}</p>
      <label className="text-sm">
        {t.help.name}
        <input
          value={name}
          onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, ''))}
          maxLength={16}
          autoComplete="username"
          required
          className={`${inputClass} mt-1`}
        />
      </label>
      <label className="text-sm">
        {t.help.password}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          maxLength={128}
          autoComplete="current-password"
          required
          className={`${inputClass} mt-1`}
        />
      </label>
      {error && <p className="text-sm text-pink">{error}</p>}
      <button disabled={busy} className="btn-pixel mt-1 bg-grass px-5 py-2.5 text-white disabled:opacity-60">
        {t.help.signIn}
      </button>
    </form>
  );
}
