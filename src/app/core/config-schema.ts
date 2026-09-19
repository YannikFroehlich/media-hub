import { z } from 'zod';
import { ExportEnvelope, MediaHubConfig } from './models';

export const SHORTCUTS_PER_GROUP_LIMIT = 50;
export const LIQUID_GLASS_BACKGROUND_DATA_LIMIT = 1_400_000;
export const LIQUID_GLASS_BLUR_MAX = 20;
export const PROFILE_LIMIT = 8;
export const SCREENSAVER_IMAGE_LIMIT = 20;

const colorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/)
  .transform((value) => value.toUpperCase());
const presetIconSchema = z.object({ kind: z.literal('preset'), id: z.string().min(1).max(64) });
const fontAwesomeIconSchema = z.object({
  kind: z.literal('font-awesome'),
  family: z.enum(['fa-solid', 'fa-regular', 'fa-brands']),
  name: z.string().regex(/^fa-[a-z0-9-]+$/),
});
const iconSchema = z.discriminatedUnion('kind', [presetIconSchema, fontAwesomeIconSchema]);
const shortcutIconSchema = z.discriminatedUnion('kind', [
  presetIconSchema,
  fontAwesomeIconSchema,
  z.object({ kind: z.literal('website') }),
]);
const liquidGlassBackgroundSchema = z.union([
  z.literal(''),
  z
    .string()
    .max(LIQUID_GLASS_BACKGROUND_DATA_LIMIT)
    .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
]);

const httpUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Nur HTTP(S)-Adressen ohne Zugangsdaten sind erlaubt.');

const shortcutSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(48),
  url: z.string().trim().min(1).max(2048),
  icon: shortcutIconSchema,
  color: colorSchema,
  openBehavior: z.enum(['inherit', 'same-tab', 'new-tab']),
  enabled: z.boolean(),
});

const groupSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(48),
  description: z.string().trim().max(120).optional(),
  icon: iconSchema,
  color: colorSchema,
  layout: z.enum(['compact', 'standard', 'large']),
  options: z.object({
    allowShortcutReordering: z.boolean(),
    showTitle: z.boolean(),
    useAccentBackground: z.boolean(),
  }),
  shortcuts: z.array(shortcutSchema).max(SHORTCUTS_PER_GROUP_LIMIT),
});
const groupsArraySchema = z.array(groupSchema).max(30);

const settingsSchema = z.object({
  theme: z.enum(['dark', 'light']),
  visualStyle: z.enum(['classic', 'liquid-glass', 'minimalist']).default('classic'),
  classicPointerEffects: z.boolean().default(true),
  liquidGlassBackgroundImage: liquidGlassBackgroundSchema.default(''),
  liquidGlassGroupBlur: z.number().int().min(0).max(LIQUID_GLASS_BLUR_MAX).default(3),
  liquidGlassShortcutBlur: z.number().int().min(0).max(LIQUID_GLASS_BLUR_MAX).default(0),
  displayMode: z.enum(['standard', 'tv']).default('standard'),
  defaultOpenBehavior: z.enum(['same-tab', 'new-tab']),
  searchEngine: z.object({
    name: z.string().trim().min(1).max(32),
    urlTemplate: z.string().refine((value) => {
      if ((value.match(/\{query\}/g) ?? []).length !== 1) return false;
      try {
        return ['http:', 'https:'].includes(new URL(value.replace('{query}', 'test')).protocol);
      } catch {
        return false;
      }
    }, 'Die Suchvorlage benötigt genau einen {query}-Platzhalter.'),
  }),
  showSubtitle: z.boolean(),
  showKeyboardHint: z.boolean(),
  autoTheme: z.boolean().default(false),
  highContrast: z.boolean().default(false),
  screensaverEnabled: z.boolean().default(true),
  screensaverImages: z.array(httpUrlSchema).max(SCREENSAVER_IMAGE_LIMIT).default([]),
  weatherEnabled: z.boolean().default(false),
  weatherLocation: z.string().default(''),
  weatherLat: z.number().nullable().default(null),
  weatherLon: z.number().nullable().default(null),
});

const profileSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(48),
  settings: settingsSchema,
  groups: groupsArraySchema,
});

const configV2ObjectSchema = z.object({
  schemaVersion: z.literal(2),
  updatedAt: z.string(),
  activeProfileId: z.string(),
  profiles: z.array(profileSchema).min(1).max(PROFILE_LIMIT),
});

const configV1ObjectSchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string(),
  settings: settingsSchema,
  groups: groupsArraySchema,
});

export const mediaHubConfigSchema = z
  .discriminatedUnion('schemaVersion', [configV2ObjectSchema, configV1ObjectSchema])
  .transform((config) =>
    config.schemaVersion === 1
      ? {
          schemaVersion: 2 as const,
          updatedAt: config.updatedAt,
          activeProfileId: 'default',
          profiles: [
            { id: 'default', name: 'Standard', settings: config.settings, groups: config.groups },
          ],
        }
      : config,
  )
  .superRefine((config, context) => {
    const profileIds = new Set<string>();
    for (const profile of config.profiles) {
      if (profileIds.has(profile.id)) {
        context.addIssue({ code: 'custom', message: `Doppelte Profil-ID: ${profile.id}` });
      }
      profileIds.add(profile.id);

      const ids = new Set<string>();
      for (const group of profile.groups) {
        for (const id of [group.id, ...group.shortcuts.map((item) => item.id)]) {
          if (ids.has(id)) {
            context.addIssue({ code: 'custom', message: `Doppelte ID: ${id}` });
          }
          ids.add(id);
        }
      }
    }
    if (!profileIds.has(config.activeProfileId)) {
      context.addIssue({
        code: 'custom',
        message: `Unbekanntes aktives Profil: ${config.activeProfileId}`,
      });
    }
  });

export const exportEnvelopeSchema = z.object({
  format: z.literal('media-hub-config'),
  exportVersion: z.literal(1),
  exportedAt: z.string(),
  config: mediaHubConfigSchema,
});

export function parseConfig(value: unknown): MediaHubConfig {
  return mediaHubConfigSchema.parse(value) as MediaHubConfig;
}

export function parseExport(value: unknown): ExportEnvelope {
  return exportEnvelopeSchema.parse(value) as ExportEnvelope;
}
