import { TestBed } from '@angular/core/testing';
import { WebsiteIconResolver } from './website-icon-resolver';

describe('WebsiteIconResolver', () => {
  let service: WebsiteIconResolver;

  beforeEach(() => {
    service = TestBed.inject(WebsiteIconResolver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a favicon service URL from a safe website URL', () => {
    expect(service.resolve('https://example.com/path')).toBe(
      'https://www.google.com/s2/favicons?sz=128&domain_url=https%3A%2F%2Fexample.com%2Fpath',
    );
  });

  it('accepts a domain without a protocol', () => {
    expect(service.resolve('example.com')).toContain('domain_url=https%3A%2F%2Fexample.com%2F');
  });

  it('rejects unsafe schemes and embedded credentials', () => {
    expect(service.resolve('javascript:alert(1)')).toBeNull();
    expect(service.resolve('https://user:pass@example.com')).toBeNull();
  });

  it('fetches and caches an icon on a cache miss', async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const cache = { match: vi.fn().mockResolvedValue(undefined), put };
    vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue(cache) });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ clone: () => ({}), blob: () => Promise.resolve(new Blob()) }),
    );
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:icon');

    const result = await service.getCachedIconUrl('https://example.com/favicon.png');

    expect(result).toBe('blob:icon');
    expect(put).toHaveBeenCalledOnce();
    createObjectURL.mockRestore();
  });

  it('reuses a cached icon without re-fetching', async () => {
    const cachedResponse = { clone: () => ({}), blob: () => Promise.resolve(new Blob()) };
    const put = vi.fn();
    const cache = { match: vi.fn().mockResolvedValue(cachedResponse), put };
    vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue(cache) });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:icon');

    const result = await service.getCachedIconUrl('https://example.com/favicon.png');

    expect(result).toBe('blob:icon');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    createObjectURL.mockRestore();
  });

  it('falls back to the remote URL when Cache Storage is unavailable', async () => {
    vi.stubGlobal('caches', undefined);
    const result = await service.getCachedIconUrl('https://example.com/favicon.png');
    expect(result).toBe('https://example.com/favicon.png');
  });
});
