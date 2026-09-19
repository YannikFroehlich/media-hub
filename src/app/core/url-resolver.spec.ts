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

  it('routes known search prefixes to their engine', () => {
    const template = 'https://google.com/search?q={query}';
    expect(service.resolve('yt lo-fi beats', template)).toBe(
      'https://www.youtube.com/results?search_query=lo-fi%20beats',
    );
    expect(service.resolve('WIKI Berlin', template)).toBe(
      'https://de.wikipedia.org/w/index.php?search=Berlin',
    );
  });

  it('treats unknown or prototype-named prefixes as a normal search', () => {
    const template = 'https://google.com/search?q={query}';
    expect(service.resolve('ytx katzen', template)).toBe(
      'https://google.com/search?q=ytx%20katzen',
    );
    expect(service.resolve('constructor foo', template)).toBe(
      'https://google.com/search?q=constructor%20foo',
    );
    expect(service.resolve('yt', template)).toBe('https://google.com/search?q=yt');
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
