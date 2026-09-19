import { Injectable } from '@angular/core';

/** Search prefixes, e.g. "yt katzen" searches YouTube instead of the default engine. */
export const SEARCH_PREFIXES: Readonly<Record<string, string>> = {
  yt: 'https://www.youtube.com/results?search_query={query}',
  wiki: 'https://de.wikipedia.org/w/index.php?search={query}',
  ddg: 'https://duckduckgo.com/?q={query}',
  g: 'https://www.google.com/search?q={query}',
  maps: 'https://www.google.com/maps/search/{query}',
};

@Injectable({ providedIn: 'root' })
export class UrlResolver {
  resolve(input: string, searchTemplate: string): string | null {
    const value = input.trim();
    if (!value) return null;

    const prefixed = /^(\S+)\s+(.+)$/.exec(value);
    const prefix = prefixed?.[1].toLowerCase() ?? '';
    if (prefixed && Object.hasOwn(SEARCH_PREFIXES, prefix)) {
      return SEARCH_PREFIXES[prefix].replace('{query}', encodeURIComponent(prefixed[2]));
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      return this.safeHttpUrl(value);
    }

    const looksLikeHost =
      /^(localhost|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(?:\/.*)?$/i.test(value) ||
      /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/.*)?$/i.test(value);

    if (looksLikeHost) return this.safeHttpUrl(`https://${value}`);
    return searchTemplate.replace('{query}', encodeURIComponent(value));
  }

  safeHttpUrl(value: string): string | null {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
      return url.toString();
    } catch {
      return null;
    }
  }

  normalizeHttpUrl(input: string): string | null {
    const value = input.trim();
    if (!value) return null;

    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
    return this.safeHttpUrl(hasScheme ? value : `https://${value}`);
  }
}
