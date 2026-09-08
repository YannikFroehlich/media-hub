import { describe, expect, it } from 'vitest';
import { parseConfig } from './config-schema';
import { createDefaultConfig } from './default-config';

describe('parseConfig', () => {
  it('adds the classic visual style to an existing saved configuration', () => {
    const existingConfig = createDefaultConfig() as unknown as {
      settings: Record<string, unknown>;
    };
    delete existingConfig.settings['visualStyle'];
    delete existingConfig.settings['liquidGlassBackgroundImage'];

    expect(parseConfig(existingConfig).settings.visualStyle).toBe('classic');
    expect(parseConfig(existingConfig).settings.liquidGlassBackgroundImage).toBe('');
  });

  it('preserves the selected liquid glass style', () => {
    const config = createDefaultConfig();
    config.settings.visualStyle = 'liquid-glass';
    config.settings.liquidGlassBackgroundImage = 'data:image/png;base64,AA==';

    expect(parseConfig(config).settings.visualStyle).toBe('liquid-glass');
    expect(parseConfig(config).settings.liquidGlassBackgroundImage).toBe(
      'data:image/png;base64,AA==',
    );
  });
});
