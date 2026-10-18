import {
  ChangeDetectionStrategy, Component, DOCUMENT, DestroyRef, ElementRef, NgZone, afterNextRender, computed, effect, inject,
} from '@angular/core';
import { FX, FxService } from '../core/fx';
import { LightboxService } from '../core/lightbox.service';
import { ArrowComponent } from './ui';
import { I18N } from '../core/i18n';

/** Visionneuse photo plein écran (flèches, clavier, glissement du doigt). */
@Component({
  selector: 'app-lightbox',
  imports: [ArrowComponent, FX, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'key($event)' },
  template: `
    <div class="lightbox" [class.open]="open()" role="dialog" aria-modal="true" [attr.aria-label]="'Visionneuse photo' | tr"
         (click)="backdrop($event)" (pointerdown)="startX = $event.clientX" (pointerup)="swipe($event)">
      @if (current(); as item) {
        <span class="lb-count">{{ counter() }}</span>
        <button type="button" class="close" [attr.aria-label]="'Fermer' | tr" (click)="lb.close()">×</button>
        <button type="button" class="lb-nav lb-prev" [attr.aria-label]="'Photo précédente' | tr" (click)="lb.step(-1)"><app-arrow [back]="true" /></button>
        <figure>
          @for (i of [lb.index()]; track i) {
            <img class="swap" [src]="item.src" [alt]="item.alt" />
          }
          <figcaption>{{ item.caption }}</figcaption>
        </figure>
        <button type="button" class="lb-nav lb-next" [attr.aria-label]="'Photo suivante' | tr" (click)="lb.step(1)"><app-arrow /></button>
      }
    </div>
  `,
})
export class LightboxComponent {
  protected readonly lb = inject(LightboxService);
  private readonly doc = inject(DOCUMENT);
  private readonly fx = inject(FxService);
  protected readonly open = computed(() => this.lb.index() >= 0);
  protected readonly current = computed(() => this.lb.items()[this.lb.index()] ?? null);
  protected readonly counter = computed(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(this.lb.index() + 1)} / ${pad(this.lb.items().length)}`;
  });
  startX: number | null = null;

  constructor() {
    effect(() => {
      const open = this.open();
      if (this.fx.isBrowser) {
        this.doc.body.style.overflow = open ? 'hidden' : '';
      }
    });
  }

  protected key(e: KeyboardEvent): void {
    if (!this.open()) {
      return;
    }
    if (e.key === 'Escape') this.lb.close();
    if (e.key === 'ArrowRight') this.lb.step(1);
    if (e.key === 'ArrowLeft') this.lb.step(-1);
  }

  protected backdrop(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    if (t.classList.contains('lightbox') || t.tagName === 'FIGURE') {
      this.lb.close();
    }
  }

  protected swipe(e: PointerEvent): void {
    if (this.startX === null) {
      return;
    }
    const dx = e.clientX - this.startX;
    this.startX = null;
    if (Math.abs(dx) > 50) {
      this.lb.step(dx < 0 ? 1 : -1);
    }
  }
}

/** Curseur doré (ordinateur uniquement). */
@Component({
  selector: 'app-cursor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="cursor" aria-hidden="true"></div><div class="cursor-dot" aria-hidden="true"></div>`,
})
export class CursorComponent {
  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const fx = inject(FxService);
    const zone = inject(NgZone);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (!fx.finePointer || fx.reducedMotion) {
        return;
      }
      const ring = host.querySelector<HTMLElement>('.cursor')!;
      const dot = host.querySelector<HTMLElement>('.cursor-dot')!;
      const doc = host.ownerDocument;
      let cx = -100, cy = -100, tx = -100, ty = -100;
      let raf = 0;
      zone.runOutsideAngular(() => {
        const move = (e: PointerEvent) => {
          if (e.pointerType !== 'mouse') return;
          tx = e.clientX;
          ty = e.clientY;
          dot.style.transform = `translate(${tx}px, ${ty}px)`;
          ring.classList.add('on');
          dot.classList.add('on');
        };
        const leave = () => {
          ring.classList.remove('on');
          dot.classList.remove('on');
        };
        const over = (e: Event) => {
          const t = e.target as Element;
          const view = !!t.closest?.('[data-lightbox]');
          ring.classList.toggle('view', view);
          ring.classList.toggle('hover', !view && !!t.closest?.('a, button, input, select, textarea, label, [data-tilt]'));
        };
        const loop = () => {
          cx += (tx - cx) * 0.18;
          cy += (ty - cy) * 0.18;
          ring.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
          raf = requestAnimationFrame(loop);
        };
        doc.addEventListener('pointermove', move, { passive: true });
        doc.documentElement.addEventListener('mouseleave', leave);
        doc.addEventListener('pointerover', over);
        raf = requestAnimationFrame(loop);
        destroyRef.onDestroy(() => {
          cancelAnimationFrame(raf);
          doc.removeEventListener('pointermove', move);
          doc.documentElement.removeEventListener('mouseleave', leave);
          doc.removeEventListener('pointerover', over);
        });
      });
    });
  }
}

/** Bouton « haut de page » avec anneau de progression. */
@Component({
  selector: 'app-to-top',
  imports: [I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button type="button" class="to-top" [class.show]="fx.showToTop()" [attr.aria-label]="'Revenir en haut de la page' | tr" (click)="fx.scrollToTop()">
    <svg class="ring" viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="26" pathLength="1" /></svg>
    <svg class="up" viewBox="0 0 12 16" aria-hidden="true"><path d="M6 15V2M1 6.5 6 1.5l5 5" /></svg>
  </button>`,
})
export class ToTopComponent {
  protected readonly fx = inject(FxService);
}

