import { Injectable, signal } from '@angular/core';

export interface LightboxItem {
  src: string;
  alt: string;
  caption: string;
}

/** Visionneuse photo plein écran. */
@Injectable({ providedIn: 'root' })
export class LightboxService {
  readonly items = signal<LightboxItem[]>([]);
  readonly index = signal(-1);

  open(items: LightboxItem[], index: number): void {
    this.items.set(items);
    this.index.set(index);
  }

  close(): void {
    this.index.set(-1);
  }

  step(delta: number): void {
    const n = this.items().length;
    if (n) {
      this.index.update((i) => (i + delta + n) % n);
    }
  }
}
