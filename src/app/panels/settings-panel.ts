import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, OnInit, inject, output, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LIQUID_GLASS_BACKGROUND_DATA_LIMIT,
  LIQUID_GLASS_BLUR_MAX,
  PROFILE_LIMIT,
  parseExport,
} from '../core/config-schema';
import { ConfirmService } from '../core/confirm.service';
import { createDefaultProfile } from '../core/default-config';
import { MediaHubStore } from '../core/media-hub.store';
import { DisplayMode, ExportEnvelope, VisualStyle } from '../core/models';
import { UrlResolver } from '../core/url-resolver';
import { WeatherService } from '../core/weather.service';

const BACKGROUND_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BACKGROUND_SOURCE_SIZE_LIMIT = 15 * 1024 * 1024;
const BACKGROUND_DIRECT_STORE_LIMIT = 900_000;
const BACKGROUND_MAX_WIDTH = 1920;
const BACKGROUND_MAX_HEIGHT = 1080;

@Component({
  selector: 'app-settings-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './settings-panel.html',
  host: { style: 'display: contents' },
})
export class SettingsPanel implements OnInit {
  protected readonly store = inject(MediaHubStore);
  private readonly resolver = inject(UrlResolver);
  private readonly weatherService = inject(WeatherService);
  private readonly confirm = inject(ConfirmService);
  private readonly document = inject(DOCUMENT);

  /** Emits when the panel wants to close; `true` skips the unsaved-changes check. */
  readonly closed = output<boolean>();
  /** Emits after the active settings changed, so App can refresh weather, timers and effects. */
  readonly applied = output<void>();

  private readonly importInput = viewChild<ElementRef<HTMLInputElement>>('importInput');
  private readonly liquidGlassBackgroundInput = viewChild<ElementRef<HTMLInputElement>>(
    'liquidGlassBackgroundInput',
  );

  protected readonly liquidGlassBlurMax = LIQUID_GLASS_BLUR_MAX;
  protected readonly profileLimit = PROFILE_LIMIT;
  protected readonly error = signal<string | null>(null);
  protected readonly liquidGlassBackgroundPreview = signal<string | null>(null);

  readonly form = inject(FormBuilder).nonNullable.group({
    theme: ['dark' as 'dark' | 'light'],
    visualStyle: ['classic' as VisualStyle],
    classicPointerEffects: [true],
    liquidGlassBackgroundImage: [''],
    liquidGlassGroupBlur: [3, [Validators.min(0), Validators.max(LIQUID_GLASS_BLUR_MAX)]],
    liquidGlassShortcutBlur: [0, [Validators.min(0), Validators.max(LIQUID_GLASS_BLUR_MAX)]],
    displayMode: ['standard' as DisplayMode],
    defaultOpenBehavior: ['same-tab' as 'same-tab' | 'new-tab'],
    searchName: ['', [Validators.required, Validators.maxLength(32)]],
    searchTemplate: ['', Validators.required],
    showSubtitle: [true],
    showKeyboardHint: [true],
    autoTheme: [false],
    highContrast: [false],
    screensaverEnabled: [true],
    weatherEnabled: [false],
    weatherLocation: [''],
  });

  ngOnInit(): void {
    this.resetForm();
  }

  protected resetForm(): void {
    const settings = this.store.settings();
    this.form.reset({
      theme: settings.theme,
      visualStyle: settings.visualStyle,
      classicPointerEffects: settings.classicPointerEffects,
      liquidGlassBackgroundImage: settings.liquidGlassBackgroundImage,
      liquidGlassGroupBlur: settings.liquidGlassGroupBlur,
      liquidGlassShortcutBlur: settings.liquidGlassShortcutBlur,
      displayMode: settings.displayMode,
      defaultOpenBehavior: settings.defaultOpenBehavior,
      searchName: settings.searchEngine.name,
      searchTemplate: settings.searchEngine.urlTemplate,
      showSubtitle: settings.showSubtitle,
      showKeyboardHint: settings.showKeyboardHint,
      autoTheme: settings.autoTheme,
      highContrast: settings.highContrast,
      screensaverEnabled: settings.screensaverEnabled,
      weatherEnabled: settings.weatherEnabled,
      weatherLocation: settings.weatherLocation,
    });
    this.liquidGlassBackgroundPreview.set(
      this.backgroundPreviewStyle(settings.liquidGlassBackgroundImage),
    );
    this.error.set(null);
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const placeholders = value.searchTemplate.match(/\{query\}/g)?.length ?? 0;
    const testUrl = this.resolver.safeHttpUrl(value.searchTemplate.replace('{query}', 'test'));
    if (placeholders !== 1 || !testUrl) {
      this.error.set(
        'Die Suchvorlage benötigt genau einen {query}-Platzhalter und eine HTTP(S)-Adresse.',
      );
      return;
    }
    const settings = this.store.settings();
    let weatherLocation = settings.weatherLocation;
    let weatherLat = settings.weatherLat;
    let weatherLon = settings.weatherLon;
    if (value.weatherEnabled || value.autoTheme) {
      const geocoded = await this.weatherService.geocode(value.weatherLocation.trim() || 'Berlin');
      if (!geocoded) {
        this.error.set('Standort konnte nicht gefunden werden.');
        return;
      }
      weatherLocation = geocoded.name;
      weatherLat = geocoded.lat;
      weatherLon = geocoded.lon;
    }
    try {
      this.store.updateSettings({
        theme: value.theme,
        visualStyle: value.visualStyle,
        classicPointerEffects: value.classicPointerEffects,
        liquidGlassBackgroundImage: value.liquidGlassBackgroundImage,
        liquidGlassGroupBlur: value.liquidGlassGroupBlur,
        liquidGlassShortcutBlur: value.liquidGlassShortcutBlur,
        displayMode: value.displayMode,
        defaultOpenBehavior: value.defaultOpenBehavior,
        searchEngine: { name: value.searchName.trim(), urlTemplate: value.searchTemplate.trim() },
        showSubtitle: value.showSubtitle,
        showKeyboardHint: value.showKeyboardHint,
        autoTheme: value.autoTheme,
        highContrast: value.highContrast,
        screensaverEnabled: value.screensaverEnabled,
        weatherEnabled: value.weatherEnabled,
        weatherLocation,
        weatherLat,
        weatherLon,
      });
    } catch {
      this.error.set(
        'Das Hintergrundbild konnte nicht lokal gespeichert werden. Bitte wähle ein kleineres Bild.',
      );
      return;
    }
    this.applied.emit();
    this.closed.emit(true);
  }

  protected chooseLiquidGlassBackground(): void {
    this.liquidGlassBackgroundInput()?.nativeElement.click();
  }

  protected async selectLiquidGlassBackground(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!BACKGROUND_IMAGE_TYPES.has(file.type)) {
      this.error.set('Bitte wähle ein Bild im Format JPG, PNG oder WebP.');
      return;
    }
    if (file.size > BACKGROUND_SOURCE_SIZE_LIMIT) {
      this.error.set('Das gewählte Bild darf höchstens 15 MB groß sein.');
      return;
    }

    try {
      const dataUrl =
        file.size <= BACKGROUND_DIRECT_STORE_LIMIT
          ? await this.readFileAsDataUrl(file)
          : await this.compressBackgroundImage(file);
      if (dataUrl.length > LIQUID_GLASS_BACKGROUND_DATA_LIMIT) {
        throw new Error('Optimized image is too large');
      }
      this.form.controls.liquidGlassBackgroundImage.setValue(dataUrl);
      this.liquidGlassBackgroundPreview.set(this.backgroundPreviewStyle(dataUrl));
      this.form.markAsDirty();
      this.error.set(null);
    } catch {
      this.error.set(
        'Das Bild konnte nicht verarbeitet werden. Bitte versuche eine kleinere JPG-, PNG- oder WebP-Datei.',
      );
    }
  }

  protected resetLiquidGlassBackground(): void {
    this.form.controls.liquidGlassBackgroundImage.setValue('');
    this.liquidGlassBackgroundPreview.set(null);
    this.form.markAsDirty();
    this.error.set(null);
  }

  protected exportConfig(): void {
    const envelope: ExportEnvelope = {
      format: 'media-hub-config',
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      config: this.store.config(),
    };
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = `media-hub-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.store.notify('Konfiguration wurde exportiert.');
  }

  protected chooseImport(): void {
    this.importInput()?.nativeElement.click();
  }

  protected async importConfig(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 1024 * 1024) {
      this.error.set('Die Importdatei darf höchstens 1 MB groß sein.');
      return;
    }
    try {
      const parsed = parseExport(JSON.parse(await file.text()));
      if (
        !(await this.confirm.request(
          `Die aktuelle Konfiguration durch ${parsed.config.profiles.length} importierte Profile ersetzen?`,
          'Ersetzen',
        ))
      )
        return;
      this.store.importConfig(parsed.config);
      this.afterConfigReplaced();
    } catch {
      this.error.set(
        'Die Datei ist keine gültige Media-Hub-Konfiguration. Es wurde nichts verändert.',
      );
    }
  }

  protected async resetHub(): Promise<void> {
    if (
      !(await this.confirm.request(
        'Media Hub wirklich auf die Startkonfiguration zurücksetzen?',
        'Zurücksetzen',
      ))
    )
      return;
    this.store.reset();
    this.afterConfigReplaced();
  }

  protected addProfile(): void {
    const profiles = this.store.profiles();
    if (profiles.length >= this.profileLimit) return;
    this.store.addProfile(
      createDefaultProfile(crypto.randomUUID(), `Profil ${profiles.length + 1}`),
    );
  }

  protected async activateProfile(id: string): Promise<void> {
    if (id === this.store.activeProfileId()) return;
    if (
      this.form.dirty &&
      !(await this.confirm.request('Ungespeicherte Änderungen verwerfen?', 'Verwerfen'))
    )
      return;
    this.store.switchProfile(id);
    this.afterConfigReplaced();
  }

  protected renameProfile(id: string, name: string): void {
    this.store.renameProfile(id, name);
  }

  protected async deleteProfile(id: string, name: string): Promise<void> {
    if (!(await this.confirm.request(`Profil „${name}“ wirklich löschen?`, 'Löschen'))) return;
    this.store.deleteProfile(id);
    this.afterConfigReplaced();
  }

  /** The active settings were swapped out from under the form: re-sync both sides. */
  private afterConfigReplaced(): void {
    this.applied.emit();
    this.resetForm();
  }

  private backgroundPreviewStyle(dataUrl: string): string | null {
    return dataUrl
      ? `linear-gradient(rgba(5, 14, 23, 0.1), rgba(5, 14, 23, 0.1)), url("${dataUrl}")`
      : null;
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error('Unable to read image'));
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('Unexpected image result'));
      };
      reader.readAsDataURL(file);
    });
  }

  private async compressBackgroundImage(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file);
    try {
      if (!bitmap.width || !bitmap.height) throw new Error('Invalid image dimensions');
      const scale = Math.min(
        1,
        BACKGROUND_MAX_WIDTH / bitmap.width,
        BACKGROUND_MAX_HEIGHT / bitmap.height,
      );
      const canvas = this.document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.82, 0.68, 0.55]) {
        const dataUrl = canvas.toDataURL('image/webp', quality);
        if (dataUrl.length <= LIQUID_GLASS_BACKGROUND_DATA_LIMIT) return dataUrl;
      }
      throw new Error('Compressed image is too large');
    } finally {
      bitmap.close();
    }
  }
}
