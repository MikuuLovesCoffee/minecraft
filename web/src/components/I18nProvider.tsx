'use client';

import { createContext, useContext } from 'react';
import { dicts, type Dict, type Lang } from '@/lib/i18n';

const I18nContext = createContext<{ lang: Lang; t: Dict }>({ lang: 'uz', t: dicts.uz });

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ lang, t: dicts[lang] }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
