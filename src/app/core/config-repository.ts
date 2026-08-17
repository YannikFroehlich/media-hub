import { Injectable } from '@angular/core';
import { createDefaultConfig } from './default-config';
import { parseConfig } from './config-schema';
import { MediaHubConfig } from './models';

const STORAGE_KEY = 'media-hub.config';
const BACKUP_KEY = 'media-hub.config.backup';

export interface LoadResult {
  config: MediaHubConfig;
  recovered: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfigRepository {
  load(): LoadResult {
    const primary = localStorage.getItem(STORAGE_KEY);
    if (!primary) return { config: createDefaultConfig(), recovered: false };

    try {
      return { config: parseConfig(JSON.parse(primary)), recovered: false };
    } catch {
      const backup = localStorage.getItem(BACKUP_KEY);
      if (backup) {
        try {
          const config = parseConfig(JSON.parse(backup));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
          return { config, recovered: true };
        } catch {
          // Fall through to a safe default.
        }
      }
      return { config: createDefaultConfig(), recovered: true };
    }
  }

  save(config: MediaHubConfig): void {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) localStorage.setItem(BACKUP_KEY, current);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parseConfig(config)));
  }

  reset(): MediaHubConfig {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BACKUP_KEY);
    return createDefaultConfig();
  }
}
