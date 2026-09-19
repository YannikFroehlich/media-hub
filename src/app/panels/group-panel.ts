import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  COLOR_PRESETS,
  CUSTOM_ICON_PATTERN,
  ICON_PRESETS,
  formIcon,
  presetClass,
} from '../core/icons';
import { MediaHubStore } from '../core/media-hub.store';
import { GroupLayout, HubGroup } from '../core/models';

@Component({
  selector: 'app-group-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './group-panel.html',
  host: { style: 'display: contents' },
})
export class GroupPanel implements OnInit {
  private readonly store = inject(MediaHubStore);

  /** Group being edited, or null when creating a new one. */
  readonly groupId = input<string | null>(null);
  /** Emits when the panel wants to close; `true` skips the unsaved-changes check. */
  readonly closed = output<boolean>();
  /** Deleting is shared with the dashboard's delete button, so App owns the confirmation. */
  readonly deleteRequested = output<void>();

  protected readonly iconPresets = ICON_PRESETS;
  protected readonly colorPresets = COLOR_PRESETS;
  protected readonly error = signal<string | null>(null);

  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(48)]],
    description: ['', Validators.maxLength(120)],
    iconId: ['folder', Validators.required],
    customIcon: ['', Validators.pattern(CUSTOM_ICON_PATTERN)],
    color: ['#3882F6', Validators.pattern(/^#[0-9A-Fa-f]{6}$/)],
    layout: ['standard' as GroupLayout],
    allowShortcutReordering: [true],
    showTitle: [true],
    useAccentBackground: [false],
  });

  ngOnInit(): void {
    this.resetForm();
  }

  private existing(): HubGroup | undefined {
    return this.store.groups().find((item) => item.id === this.groupId());
  }

  protected resetForm(): void {
    const group = this.existing();
    const icon = group?.icon;
    this.form.reset({
      name: group?.name ?? 'Neue Gruppe',
      description: group?.description ?? '',
      iconId: icon?.kind === 'preset' ? icon.id : 'folder',
      customIcon: icon?.kind === 'font-awesome' ? `${icon.family} ${icon.name}` : '',
      color: group?.color ?? '#3882F6',
      layout: group?.layout ?? 'standard',
      allowShortcutReordering: group?.options.allowShortcutReordering ?? true,
      showTitle: group?.options.showTitle ?? true,
      useAccentBackground: group?.options.useAccentBackground ?? false,
    });
    this.error.set(null);
  }

  protected previewIconClass(): string {
    const value = this.form.getRawValue();
    return value.customIcon || presetClass(value.iconId);
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const existing = this.existing();
    const group: HubGroup = {
      id: existing?.id ?? crypto.randomUUID(),
      name: value.name.trim(),
      description: value.description.trim() || undefined,
      icon: formIcon(value.iconId, value.customIcon),
      color: value.color.toUpperCase(),
      layout: value.layout,
      options: {
        allowShortcutReordering: value.allowShortcutReordering,
        showTitle: value.showTitle,
        useAccentBackground: value.useAccentBackground,
      },
      shortcuts: existing?.shortcuts ?? [],
    };
    if (existing) this.store.updateGroup(group);
    else this.store.addGroup(group);
    this.closed.emit(true);
  }
}
