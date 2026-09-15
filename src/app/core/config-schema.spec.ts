import { describe, expect, it } from 'vitest';
import { PROFILE_LIMIT, parseConfig } from './config-schema';
import { createDefaultConfig, createDefaultProfile } from './default-config';

describe('parseConfig', () => {
  it('keeps pointer effects enabled for configurations saved before the option existed', () => {
    const existingConfig = createDefaultConfig() as unknown as {
      profiles: [{ settings: Record<string, unknown> }];
    };
    delete existingConfig.profiles[0].settings['classicPointerEffects'];

    expect(parseConfig(existingConfig).profiles[0].settings.classicPointerEffects).toBe(true);
  });

  it('preserves disabled pointer effects when loading a saved configuration', () => {
    const config = createDefaultConfig();
    config.profiles[0].settings.classicPointerEffects = false;

    expect(parseConfig(config).profiles[0].settings.classicPointerEffects).toBe(false);
  });

  it('adds the classic visual style to an existing saved configuration', () => {
    const existingConfig = createDefaultConfig() as unknown as {
      profiles: [{ settings: Record<string, unknown> }];
    };
    delete existingConfig.profiles[0].settings['visualStyle'];
    delete existingConfig.profiles[0].settings['liquidGlassBackgroundImage'];
    delete existingConfig.profiles[0].settings['liquidGlassGroupBlur'];
    delete existingConfig.profiles[0].settings['liquidGlassShortcutBlur'];

    const parsed = parseConfig(existingConfig);
    expect(parsed.profiles[0].settings.visualStyle).toBe('classic');
    expect(parsed.profiles[0].settings.liquidGlassBackgroundImage).toBe('');
    expect(parsed.profiles[0].settings.liquidGlassGroupBlur).toBe(3);
    expect(parsed.profiles[0].settings.liquidGlassShortcutBlur).toBe(0);
  });

  it('preserves the selected liquid glass style', () => {
    const config = createDefaultConfig();
    config.profiles[0].settings.visualStyle = 'liquid-glass';
    config.profiles[0].settings.liquidGlassBackgroundImage = 'data:image/png;base64,AA==';
    config.profiles[0].settings.liquidGlassGroupBlur = 8;
    config.profiles[0].settings.liquidGlassShortcutBlur = 4;

    const parsed = parseConfig(config);
    expect(parsed.profiles[0].settings.visualStyle).toBe('liquid-glass');
    expect(parsed.profiles[0].settings.liquidGlassBackgroundImage).toBe(
      'data:image/png;base64,AA==',
    );
    expect(parsed.profiles[0].settings.liquidGlassGroupBlur).toBe(8);
    expect(parsed.profiles[0].settings.liquidGlassShortcutBlur).toBe(4);
  });

  it('preserves the selected minimalist style', () => {
    const config = createDefaultConfig();
    config.profiles[0].settings.visualStyle = 'minimalist';

    expect(parseConfig(config).profiles[0].settings.visualStyle).toBe('minimalist');
  });

  it('rejects liquid glass blur values outside the supported range', () => {
    const config = createDefaultConfig();
    config.profiles[0].settings.liquidGlassShortcutBlur = 21;

    expect(() => parseConfig(config)).toThrow();
  });

  it('adds weather defaults to an existing saved configuration', () => {
    const existingConfig = createDefaultConfig() as unknown as {
      profiles: [{ settings: Record<string, unknown> }];
    };
    delete existingConfig.profiles[0].settings['weatherEnabled'];
    delete existingConfig.profiles[0].settings['weatherLocation'];
    delete existingConfig.profiles[0].settings['weatherLat'];
    delete existingConfig.profiles[0].settings['weatherLon'];

    const parsed = parseConfig(existingConfig);
    expect(parsed.profiles[0].settings.weatherEnabled).toBe(false);
    expect(parsed.profiles[0].settings.weatherLocation).toBe('');
    expect(parsed.profiles[0].settings.weatherLat).toBeNull();
    expect(parsed.profiles[0].settings.weatherLon).toBeNull();
  });

  it('adds autoTheme and screensaver defaults to an existing saved configuration', () => {
    const existingConfig = createDefaultConfig() as unknown as {
      profiles: [{ settings: Record<string, unknown> }];
    };
    delete existingConfig.profiles[0].settings['autoTheme'];
    delete existingConfig.profiles[0].settings['screensaverEnabled'];

    const parsed = parseConfig(existingConfig);
    expect(parsed.profiles[0].settings.autoTheme).toBe(false);
    expect(parsed.profiles[0].settings.screensaverEnabled).toBe(true);
  });

  it('adds a highContrast default to an existing saved configuration', () => {
    const existingConfig = createDefaultConfig() as unknown as {
      profiles: [{ settings: Record<string, unknown> }];
    };
    delete existingConfig.profiles[0].settings['highContrast'];

    const parsed = parseConfig(existingConfig);
    expect(parsed.profiles[0].settings.highContrast).toBe(false);
  });

  describe('profiles (schemaVersion 2)', () => {
    it('migrates a schemaVersion 1 configuration into a single "Standard" profile', () => {
      const legacyConfig = {
        schemaVersion: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
        settings: createDefaultProfile('default', 'Standard').settings,
        groups: createDefaultProfile('default', 'Standard').groups,
      };

      const parsed = parseConfig(legacyConfig);

      expect(parsed.schemaVersion).toBe(2);
      expect(parsed.profiles).toHaveLength(1);
      expect(parsed.activeProfileId).toBe(parsed.profiles[0].id);
      expect(parsed.profiles[0].groups.map((group) => group.id)).toEqual(
        legacyConfig.groups.map((group) => group.id),
      );
    });

    it('rejects an activeProfileId that does not match any profile', () => {
      const config = createDefaultConfig();
      config.activeProfileId = 'missing';

      expect(() => parseConfig(config)).toThrow();
    });

    it('rejects more than the maximum number of profiles', () => {
      const config = createDefaultConfig();
      config.profiles = Array.from({ length: PROFILE_LIMIT + 1 }, (_, index) =>
        createDefaultProfile(`profile-${index}`, `Profil ${index}`),
      );

      expect(() => parseConfig(config)).toThrow();
    });

    it('allows the same shortcut/group id to be reused across different profiles', () => {
      const config = createDefaultConfig();
      config.profiles.push(createDefaultProfile('second', 'Zweites Profil'));

      expect(() => parseConfig(config)).not.toThrow();
    });
  });
});
