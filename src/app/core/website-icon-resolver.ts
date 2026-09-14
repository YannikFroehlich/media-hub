import { Injectable, inject } from '@angular/core';
import { UrlResolver } from './url-resolver';

const FAVICON_CACHE_NAME = 'media-hub-favicons-v1';

@Injectable({ providedIn: 'root' })
export class WebsiteIconResolver {
  private readonly urlResolver = inject(UrlResolver);

  resolve(input: string): string | null {
    const value = input.trim();
    if (!value) return null;

    const websiteUrl = this.urlResolver.normalizeHttpUrl(value);
    if (!websiteUrl) return null;

    return `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(websiteUrl)}`;
  }

  // Persists the favicon locally via the Cache Storage API so tiles survive a network hiccup
  // and don't re-hit Google's proxy on every load. Falls back to the remote URL directly
  // (today's behavior) whenever Cache Storage is unavailable or the fetch/cache dance fails —
  // no-cors is used since the favicon proxy isn't guaranteed to send CORS headers.
  // ponytail: object URLs are never revoked; fine at dashboard scale, revisit if icon churn ever matters.
  async getCachedIconUrl(remoteUrl: string): Promise<string> {
    if (!('caches' in window)) return remoteUrl;
    try {
      const cache = await caches.open(FAVICON_CACHE_NAME);
      const cached = await cache.match(remoteUrl);
      const response = cached ?? (await fetch(remoteUrl, { mode: 'no-cors' }));
      if (!cached) await cache.put(remoteUrl, response.clone());
      return URL.createObjectURL(await response.blob());
    } catch {
      return remoteUrl;
    }
  }
}
