import { DOCUMENT, Injectable, NgZone, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface ParallaxItem {
  el: HTMLElement;
  speed: number;
  axis: 'y' | 'x';
}

/**
 * Moteur d'animations du site (navigateur uniquement) :
 * apparitions au défilement, parallaxe, barre de progression, en-tête, bouton « haut de page ».
 */
@Injectable({ providedIn: 'root' })
export class FxService {
  private readonly doc = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly scrolled = signal(false);
  readonly headerHidden = signal(false);
  readonly showToTop = signal(false);

  reducedMotion = false;
  finePointer = false;

  private started = false;
  private readyAt = 0;
  private observer?: IntersectionObserver;
  private readonly targets = new Map<Element, Array<() => void>>();
  private readonly parallax = new Set<ParallaxItem>();
  private readonly tickers = new Set<() => void>();
  private lastY = 0;
  private ticking = false;
  private menuOpen = false;

  /** Démarre le moteur (appelé une fois par le composant racine). */
  start(): void {
    if (!this.isBrowser || this.started) {
      return;
    }
    this.started = true;
    const win = this.doc.defaultView!;
    this.reducedMotion = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.finePointer = win.matchMedia('(pointer: fine)').matches;
    const html = this.doc.documentElement;
    const firstVisit = !html.classList.contains('intro-seen');
    try {
      win.sessionStorage.setItem('opaal-intro', '1');
    } catch {
      /* navigation privée */
    }
    // Laisse l'intro se terminer avant de lancer les apparitions
    const delay = this.reducedMotion ? 0 : firstVisit ? 2000 : 380;
    this.readyAt = performance.now() + delay;

    this.zone.runOutsideAngular(() => {
      win.addEventListener('scroll', () => this.requestTick(), { passive: true });
      win.addEventListener('resize', () => this.requestTick(), { passive: true });
      setTimeout(() => this.createObserver(), delay);
    });
    this.onScroll();
  }

  setMenuOpen(open: boolean): void {
    this.menuOpen = open;
    if (open) {
      this.headerHidden.set(false);
    }
  }

  /** Enregistre un élément qui doit recevoir la classe « in » quand il devient visible. */
  observe(target: Element, onEnter: () => void): void {
    if (!this.isBrowser) {
      return;
    }
    if (this.reducedMotion || typeof IntersectionObserver === 'undefined') {
      onEnter();
      return;
    }
    const list = this.targets.get(target) ?? [];
    list.push(onEnter);
    this.targets.set(target, list);
    if (this.observer) {
      this.observer.observe(target);
    }
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
    this.observer?.unobserve(target);
  }

  addParallax(el: HTMLElement, speed: number, axis: 'y' | 'x'): () => void {
    if (!this.isBrowser || this.reducedMotion) {
      return () => undefined;
    }
    const item: ParallaxItem = { el, speed, axis };
    this.parallax.add(item);
    this.requestTick();
    return () => this.parallax.delete(item);
  }

  addTicker(fn: () => void): () => void {
    if (!this.isBrowser) {
      return () => undefined;
    }
    this.tickers.add(fn);
    this.requestTick();
    return () => this.tickers.delete(fn);
  }

  /** Après un changement de page : ré-évalue positions et apparitions. */
  refresh(): void {
    if (!this.isBrowser) {
      return;
    }
    this.lastY = this.doc.defaultView!.scrollY;
    this.requestTick();
  }

  scrollToTop(): void {
    this.doc.defaultView?.scrollTo({ top: 0, behavior: this.reducedMotion ? 'auto' : 'smooth' });
  }

  private createObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const callbacks = this.targets.get(entry.target) ?? [];
            this.targets.delete(entry.target);
            this.observer?.unobserve(entry.target);
            callbacks.forEach((cb) => cb());
          }
        }
      },
      { threshold: 0.01, rootMargin: '0px 0px -9% 0px' },
    );
    this.targets.forEach((_, target) => this.observer!.observe(target));
  }

  private requestTick(): void {
    if (!this.ticking) {
      this.ticking = true;
      requestAnimationFrame(() => {
        this.ticking = false;
        this.onScroll();
      });
    }
  }

  private onScroll(): void {
    const win = this.doc.defaultView!;
    const y = win.scrollY;
    const vh = win.innerHeight;
    const max = this.doc.documentElement.scrollHeight - vh;
    const p = max > 0 ? Math.min(1, y / max) : 0;

    const bar = this.doc.querySelector<HTMLElement>('.progress');
    if (bar) {
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
    }
    const ring = this.doc.querySelector<SVGElement>('.to-top .ring circle');
    if (ring) {
      ring.style.strokeDashoffset = (1 - p).toFixed(3);
    }
    this.scrolled.set(y > 10);
    if (!this.menuOpen) {
      if (y > 320 && y > this.lastY + 4) {
        this.headerHidden.set(true);
      } else if (y < this.lastY - 4 || y <= 320) {
        this.headerHidden.set(false);
      }
    }
    this.lastY = y;
    this.showToTop.set(y > 700);

    for (const item of this.parallax) {
      const parent = item.el.parentElement;
      if (!parent) {
        continue;
      }
      const box = parent.getBoundingClientRect();
      if (box.bottom < -150 || box.top > vh + 150) {
        continue;
      }
      if (item.axis === 'x') {
        item.el.style.translate = `${((box.top - vh / 2) * item.speed).toFixed(1)}px 0`;
      } else {
        let off = (box.top + box.height / 2 - vh / 2) * -item.speed;
        if (item.el.tagName === 'IMG') {
          const lim = box.height * 0.032;
          off = Math.max(-lim, Math.min(lim, off));
        }
        item.el.style.translate = `0 ${off.toFixed(1)}px`;
      }
    }
    this.tickers.forEach((fn) => fn());
  }

  /** Temps restant avant la fin de l'intro (ms). */
  get introRemaining(): number {
    return Math.max(0, this.readyAt - performance.now());
  }
}
