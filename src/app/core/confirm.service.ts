import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

const PIN_MAX_LENGTH = 8;

/** Backs the single inline confirmation dialog rendered by App (replaces window.confirm). */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly document = inject(DOCUMENT);
  private readonly stateSignal = signal<{
    message: string;
    confirmLabel: string;
    pin: boolean;
  } | null>(null);
  private resolver: ((result: boolean) => void) | null = null;
  private trigger: HTMLElement | null = null;

  readonly state = this.stateSignal.asReadonly();
  /** Digits typed or tapped into the PIN field while a `requestPin` dialog is open. */
  readonly pin = signal('');

  request(message: string, confirmLabel = 'Bestätigen'): Promise<boolean> {
    return this.open(message, confirmLabel, false);
  }

  /** The same dialog with a PIN field and an on-screen keypad (usable with a gamepad). */
  async requestPin(message: string): Promise<string | null> {
    this.pin.set('');
    return (await this.open(message, 'Entsperren', true)) ? this.pin() : null;
  }

  setPin(value: string): void {
    this.pin.set(value.replace(/\D/g, '').slice(0, PIN_MAX_LENGTH));
  }

  appendPinDigit(digit: string): void {
    this.setPin(this.pin() + digit);
  }

  removePinDigit(): void {
    this.pin.update((value) => value.slice(0, -1));
  }

  resolve(result: boolean): void {
    this.stateSignal.set(null);
    this.resolver?.(result);
    this.resolver = null;
    // Whoever awaited the result may already have opened the next modal (e.g. a side panel after
    // unlocking); don't pull focus back out of it.
    window.setTimeout(() => {
      if (!this.document.activeElement?.closest('[aria-modal="true"]')) this.trigger?.focus();
    });
  }

  private open(message: string, confirmLabel: string, pin: boolean): Promise<boolean> {
    this.trigger = this.document.activeElement as HTMLElement | null;
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.stateSignal.set({ message, confirmLabel, pin });
    });
  }
}
