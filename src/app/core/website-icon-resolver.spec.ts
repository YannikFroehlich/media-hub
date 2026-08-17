import { TestBed } from '@angular/core/testing';
import { WebsiteIconResolver } from './website-icon-resolver';

describe('WebsiteIconResolver', () => {
  let service: WebsiteIconResolver;

  beforeEach(() => {
    service = TestBed.inject(WebsiteIconResolver);
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
});
