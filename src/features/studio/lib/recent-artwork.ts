import type { ArtworkItem } from "../types";

const KEY = "mimo.studio.recent-artwork.v1";
const MAX = 24;

/** Artwork the user placed recently, newest first (per device). */
export function loadRecent(): ArtworkItem[] {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as ArtworkItem[]) : [];
    return Array.isArray(list) ? list.filter((i) => i && i.id && i.src) : [];
  } catch {
    return [];
  }
}

export function pushRecent(item: ArtworkItem): ArtworkItem[] {
  const next = [item, ...loadRecent().filter((i) => i.id !== item.id)].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  return next;
}

export function dropRecent(id: string): ArtworkItem[] {
  const next = loadRecent().filter((i) => i.id !== id);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  return next;
}

/** Newest first when every item carries a timestamp; otherwise the server order is kept. */
export function newestFirst<T extends { id: string; createdAt?: string }>(items: T[]): T[] {
  if (!items.every((i) => i.createdAt)) return items;
  return [...items].sort((a, b) => Date.parse(b.createdAt!) - Date.parse(a.createdAt!));
}
