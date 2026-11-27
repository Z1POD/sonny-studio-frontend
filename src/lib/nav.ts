/** Splits "/path?a=1&b=2" into TanStack Router `to` + `search` (the router doesn't accept query strings in `to`). */
export function parseHref(href: string): { to: string; search: Record<string, string> } {
  const [to = "/", query = ""] = href.split("?");
  return { to, search: Object.fromEntries(new URLSearchParams(query)) };
}
