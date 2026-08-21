import { z } from 'zod';
import { ExportEnvelope, MediaHubConfig } from './models';

export const SHORTCUTS_PER_GROUP_LIMIT = 50;

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

export const mediaHubConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    updatedAt: z.string(),
    settings: z.object({
      theme: z.enum(['dark', 'light']),
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
    }),
    groups: z.array(groupSchema).max(30),
  })
  .superRefine((config, context) => {
    const ids = new Set<string>();
    for (const group of config.groups) {
      for (const id of [group.id, ...group.shortcuts.map((item) => item.id)]) {
        if (ids.has(id)) {
          context.addIssue({ code: 'custom', message: `Doppelte ID: ${id}` });
        }
        ids.add(id);
      }
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
