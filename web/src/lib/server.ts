import 'server-only';
import { cookies } from 'next/headers';
import { getDict, type Lang } from './i18n';

const API = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3031/api';

export interface Player {
  name: string;
  money: number;
  kills: number;
  mobKills: number;
  deaths: number;
  playTicks: number;
  blocksMined: number;
  quizWins: number;
  quizMoney: number;
  lastSeen: string | null;
}

export interface Status {
  online: boolean;
  players: { online: number; max: number; sample: string[] };
  version: string | null;
}

/** Server-side fetch from the NestJS API; returns null instead of throwing so pages still render if the API is down. */
export async function api<T>(path: string, revalidate = 30): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { next: { revalidate } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function getLang(): Promise<Lang> {
  return (await cookies()).get('lang')?.value === 'en' ? 'en' : 'uz';
}

export async function dict() {
  return getDict(await getLang());
}
