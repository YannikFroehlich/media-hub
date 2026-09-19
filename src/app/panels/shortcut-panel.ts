import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmService } from '../core/confirm.service';
import {
  COLOR_PRESETS,
  CUSTOM_ICON_PATTERN,
  ICON_PRESETS,
  formIcon,
  handleWebsiteIconError,
  handleWebsiteIconLoad,
  presetClass,
} from '../core/icons';
import { MediaHubStore } from '../core/media-hub.store';
import { OpenBehavior, Shortcut } from '../core/models';
import { UrlResolver } from '../core/url-resolver';
import { WebsiteIconResolver } from '../core/website-icon-resolver';

@Component({
  selector: 'app-shortcut-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './shortcut-panel.html',
  host: { style: 'display: contents' },
})
export class ShortcutPanel implements OnInit {
  protected readonly store = inject(MediaHubStore);
  private readonly resolver = inject(UrlResolver);
  private readonly websiteIconResolver = inject(WebsiteIconResolver);
  private readonly confirm = inject(ConfirmService);

  /** Group the panel was opened from; also the source group when deleting. */
  readonly groupId = input<string | null>(null);
  /** Shortcut being edited, or null when adding a new one. */
  readonly shortcutId = input<string | null>(null);
  /** Emits when the panel wants to close; `true` skips the unsaved-changes check. */
  readonly closed = output<boolean>();

  protected readonly iconPresets = ICON_PRESETS;
  protected readonly colorPresets = COLOR_PRESETS;
  protected readonly error = signal<string | null>(null);
  protected readonly handleWebsiteIconLoad = handleWebsiteIconLoad;
  protected readonly handleWebsiteIconError = handleWebsiteIconError;

  readonly form = inject(FormBuilder).nonNullable.group({
    targetGroupId: ['', Validators.required],
    name: ['', [Validators.required, Validators.maxLength(48)]],
    url: ['', [Validators.required, Validators.maxLength(2048)]],
    useWebsiteIcon: [false],
    iconId: ['youtube', Validators.required],
    customIcon: ['', Validators.pattern(CUSTOM_ICON_PATTERN)],
    color: ['#7C4DFF', Validators.pattern(/^#[0-9A-Fa-f]{6}$/)],
    openBehavior: ['inherit' as OpenBehavior],
    enabled: [true],
  });

  ngOnInit(): void {
    this.resetForm();
  }

  protected resetForm(): void {
    const groups = this.store.groups();
    const group = groups.find((item) => item.id === this.groupId());
    const shortcut = groups
      .flatMap((item) => item.shortcuts)
      .find((item) => item.id === this.shortcutId());
    const icon = shortcut?.icon;
    this.form.reset({
      targetGroupId: group?.id ?? groups[0]?.id ?? '',
      name: shortcut?.name ?? '',
      url: shortcut?.url === '#settings' ? '' : (shortcut?.url ?? ''),
      useWebsiteIcon: icon?.kind === 'website',
      iconId: icon?.kind === 'preset' ? icon.id : 'globe',
      customIcon: icon?.kind === 'font-awesome' ? `${icon.family} ${icon.name}` : '',
      color: shortcut?.color ?? group?.color ?? '#7C4DFF',
      openBehavior: shortcut?.openBehavior ?? 'inherit',
      enabled: shortcut?.enabled ?? true,
    });
    this.error.set(null);
  }

  protected previewIconClass(): string {
    const value = this.form.getRawValue();
    return value.customIcon || presetClass(value.iconId);
  }

  protected websiteIconUrl(url: string): string | null {
    return this.websiteIconResolver.resolve(url);
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const url = this.resolver.normalizeHttpUrl(value.url);
    if (!url) {
      this.error.set('Bitte gib eine gültige HTTP- oder HTTPS-Adresse ein.');
      return;
    }
    const shortcut: Shortcut = {
      id: this.shortcutId() ?? crypto.randomUUID(),
      name: value.name.trim(),
      url,
      icon: value.useWebsiteIcon ? { kind: 'website' } : formIcon(value.iconId, value.customIcon),
      color: value.color.toUpperCase(),
      openBehavior: value.openBehavior,
      enabled: value.enabled,
    };
    this.store.upsertShortcut(value.targetGroupId, shortcut);
    this.closed.emit(true);
  }

  protected async delete(): Promise<void> {
    const groupId = this.groupId();
    const shortcutId = this.shortcutId();
    if (!groupId || !shortcutId) return;
    if (!(await this.confirm.request('Diese Verknüpfung wirklich löschen?', 'Löschen'))) return;
    this.store.deleteShortcut(groupId, shortcutId);
    this.closed.emit(true);
  }
}
