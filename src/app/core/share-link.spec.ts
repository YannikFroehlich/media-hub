import { describe, expect, it } from 'vitest';
import { parseConfig } from './config-schema';
import { createDefaultConfig } from './default-config';
import { createShareLink, readShareHash } from './share-link';

describe('share link', () => {
  it('round-trips the config through the URL hash without the background image', async () => {
    const config = createDefaultConfig();
    config.profiles[0].settings.liquidGlassBackgroundImage = 'data:image/png;base64,AAAA';

    const link = await createShareLink(config, 'https://hub.example/');
    const url = new URL(link);

    expect(url.origin + url.pathname).toBe('https://hub.example/');
    const restored = await readShareHash(url.hash);
    expect(restored?.profiles[0].groups).toEqual(parseConfig(config).profiles[0].groups);
    expect(restored?.profiles[0].settings.liquidGlassBackgroundImage).toBe('');
  });

  it('ignores ordinary hashes', async () => {
    expect(await readShareHash('')).toBeNull();
    expect(await readShareHash('#top')).toBeNull();
  });

  it('rejects links that do not hold a valid config', async () => {
    const config = createDefaultConfig();
    config.profiles[0].groups[0].shortcuts[0].color = 'red';
    const link = await createShareLink(config, 'https://hub.example/');

    await expect(readShareHash(new URL(link).hash)).rejects.toThrow();
    await expect(readShareHash('#import=not-deflate')).rejects.toThrow();
  });
});
