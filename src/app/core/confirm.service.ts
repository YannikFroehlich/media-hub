import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

/** Backs the single inline confirmation dialog rendered by App (replaces window.confirm). */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly document = inject(DOCUMENT);
  private readonly stateSignal = signal<{ message: string; confirmLabel: string } | null>(null);
  private resolver: ((result: boolean) => void) | null = null;
  private trigger: HTMLElement | null = null;

  readonly state = this.stateSignal.asReadonly();

  request(message: string, confirmLabel = 'Bestätigen'): Promise<boolean> {
    this.trigger = this.document.activeElement as HTMLElement | null;
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.stateSignal.set({ message, confirmLabel });
    });
  }

  resolve(result: boolean): void {
    this.stateSignal.set(null);
    this.resolver?.(result);
    this.resolver = null;
    window.setTimeout(() => this.trigger?.focus());
  }
}
