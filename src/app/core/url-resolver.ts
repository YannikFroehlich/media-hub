import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UrlResolver {
  resolve(input: string, searchTemplate: string): string | null {
    const value = input.trim();
    if (!value) return null;

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
