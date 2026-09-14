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
    delete existingConfig.settings['liquidGlassGroupBlur'];
    delete existingConfig.settings['liquidGlassShortcutBlur'];

    expect(parseConfig(existingConfig).settings.visualStyle).toBe('classic');
    expect(parseConfig(existingConfig).settings.liquidGlassBackgroundImage).toBe('');
    expect(parseConfig(existingConfig).settings.liquidGlassGroupBlur).toBe(3);
    expect(parseConfig(existingConfig).settings.liquidGlassShortcutBlur).toBe(0);
  });

  it('preserves the selected liquid glass style', () => {
    const config = createDefaultConfig();
    config.settings.visualStyle = 'liquid-glass';
    config.settings.liquidGlassBackgroundImage = 'data:image/png;base64,AA==';
    config.settings.liquidGlassGroupBlur = 8;
    config.settings.liquidGlassShortcutBlur = 4;

    expect(parseConfig(config).settings.visualStyle).toBe('liquid-glass');
    expect(parseConfig(config).settings.liquidGlassBackgroundImage).toBe(
      'data:image/png;base64,AA==',
    );
    expect(parseConfig(config).settings.liquidGlassGroupBlur).toBe(8);
    expect(parseConfig(config).settings.liquidGlassShortcutBlur).toBe(4);
  });

  it('preserves the selected minimalist style', () => {
    const config = createDefaultConfig();
    config.settings.visualStyle = 'minimalist';

    expect(parseConfig(config).settings.visualStyle).toBe('minimalist');
  });

  it('rejects liquid glass blur values outside the supported range', () => {
    const config = createDefaultConfig();
    config.settings.liquidGlassShortcutBlur = 21;

    expect(() => parseConfig(config)).toThrow();
  });

  it('adds weather defaults to an existing saved configuration', () => {
    const existingConfig = createDefaultConfig() as unknown as {
      settings: Record<string, unknown>;
    };
    delete existingConfig.settings['weatherEnabled'];
    delete existingConfig.settings['weatherLocation'];
    delete existingConfig.settings['weatherLat'];
    delete existingConfig.settings['weatherLon'];

    const parsed = parseConfig(existingConfig);
    expect(parsed.settings.weatherEnabled).toBe(false);
    expect(parsed.settings.weatherLocation).toBe('');
    expect(parsed.settings.weatherLat).toBeNull();
    expect(parsed.settings.weatherLon).toBeNull();
  });

  it('adds autoTheme and screensaver defaults to an existing saved configuration', () => {
    const existingConfig = createDefaultConfig() as unknown as {
      settings: Record<string, unknown>;
    };
    delete existingConfig.settings['autoTheme'];
    delete existingConfig.settings['screensaverEnabled'];

    const parsed = parseConfig(existingConfig);
    expect(parsed.settings.autoTheme).toBe(false);
    expect(parsed.settings.screensaverEnabled).toBe(true);
  });

  it('adds a highContrast default to an existing saved configuration', () => {
    const existingConfig = createDefaultConfig() as unknown as {
      settings: Record<string, unknown>;
    };
    delete existingConfig.settings['highContrast'];

    const parsed = parseConfig(existingConfig);
    expect(parsed.settings.highContrast).toBe(false);
  });
});
