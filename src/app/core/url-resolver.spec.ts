import { TestBed } from '@angular/core/testing';
import { UrlResolver } from './url-resolver';

describe('UrlResolver', () => {
  let service: UrlResolver;

  beforeEach(() => {
    service = TestBed.inject(UrlResolver);
  });

  it('keeps safe HTTP URLs', () => {
    expect(service.resolve('https://example.com/path', 'https://google.com/search?q={query}')).toBe(
      'https://example.com/path',
    );
  });

  it('adds HTTPS to domain-like values', () => {
    expect(service.resolve('example.com/path', 'https://google.com/search?q={query}')).toBe(
      'https://example.com/path',
    );
  });

  it('turns other input into a search', () => {
    expect(service.resolve('media hub', 'https://google.com/search?q={query}')).toBe(
      'https://google.com/search?q=media%20hub',
    );
  });

  it('rejects unsafe protocols and embedded credentials', () => {
    expect(
      service.resolve('javascript:alert(1)', 'https://google.com/search?q={query}'),
    ).toBeNull();
    expect(
      service.resolve('https://user:pass@example.com', 'https://google.com/search?q={query}'),
    ).toBeNull();
  });

  it('normalizes only addresses without an existing scheme', () => {
    expect(service.normalizeHttpUrl('example.com')).toBe('https://example.com/');
    expect(service.normalizeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(service.normalizeHttpUrl('https://user:pass@example.com')).toBeNull();
  });
});
