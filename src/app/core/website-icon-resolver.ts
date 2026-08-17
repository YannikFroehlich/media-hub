import { Injectable, inject } from '@angular/core';
import { UrlResolver } from './url-resolver';

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
}
