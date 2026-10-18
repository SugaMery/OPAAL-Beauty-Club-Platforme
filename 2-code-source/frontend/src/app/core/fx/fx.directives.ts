import { DestroyRef, Directive, ElementRef, NgZone, afterNextRender, inject } from '@angular/core';
import { FxService } from './fx.service';

/** Découpe le texte d'un élément en mots animables (<span class="w"><span class="wi">). */
export function splitWords(root: HTMLElement, counter = { n: 0 }): HTMLElement[] {
  const words: HTMLElement[] = [];
  const doc = root.ownerDocument;
  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType === 3) {
      const frag = doc.createDocumentFragment();
      (node.textContent ?? '').split(/(\s+)/).forEach((part) => {
        if (!part) {
          return;
        }
        if (/^\s+$/.test(part)) {
          frag.appendChild(doc.createTextNode(' '));
          return;
        }
        const w = doc.createElement('span');
        const wi = doc.createElement('span');
        w.className = 'w';
        wi.className = 'wi';
        wi.style.setProperty('--i', String(counter.n++));
        wi.textContent = part;
        w.appendChild(wi);
        frag.appendChild(w);
        words.push(wi);
      });
      node.parentNode?.replaceChild(frag, node);
    } else if (node.nodeType === 1 && (node as Element).tagName !== 'BR') {
      words.push(...splitWords(node as HTMLElement, counter));
    }
  });
  return words;
}

/**
 * Apparition au défilement.
 * - data-anim="up|fade|left|right|zoom|mask|mask-left"
 * - data-split : titre révélé mot par mot (texte statique uniquement)
 * - data-stagger="0.12" : décale l'apparition des enfants
 * - .draw : tracé des lignes SVG
 */
@Directive({ selector: '[data-anim], [data-split], [data-stagger], .draw, .title-rule, .steps, .palette, .arch' })
export class RevealDirective {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const fx = inject(FxService);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (el.hasAttribute('data-split')) {
        splitWords(el);
      }
      const stagger = el.getAttribute('data-stagger');
      if (stagger !== null) {
        const step = parseFloat(stagger) || 0.12;
        const base = parseFloat(el.getAttribute('data-stagger-base') ?? '') || 0;
        Array.from(el.children).forEach((child, i) => {
          const c = child as HTMLElement;
          if (!c.style.getPropertyValue('--d')) {
            c.style.setProperty('--d', (base + i * step).toFixed(2) + 's');
          }
          c.style.setProperty('--dd', (base + i * step + 0.3).toFixed(2) + 's');
          c.style.setProperty('--i', String(i));
        });
      }
      const anim = el.getAttribute('data-anim') ?? '';
      const target = anim.startsWith('mask') && el.parentElement ? el.parentElement : el;
      fx.observe(target, () => el.classList.add('in'));
      destroyRef.onDestroy(() => fx.unobserve(target));
    });
  }
}

/** Parallaxe verticale (data-parallax="0.1") ou horizontale (data-parallax-x="0.12"). */
@Directive({ selector: '[data-parallax], [data-parallax-x]' })
export class ParallaxDirective {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const fx = inject(FxService);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const x = el.getAttribute('data-parallax-x');
      const stop = x !== null
        ? fx.addParallax(el, parseFloat(x) || 0.2, 'x')
        : fx.addParallax(el, parseFloat(el.getAttribute('data-parallax') ?? '') || 0.1, 'y');
      destroyRef.onDestroy(stop);
    });
  }
}

/** Carte qui s'incline en 3D en suivant la souris (data-tilt="12", data-tilt-base="rotate(-7deg)"). */
@Directive({ selector: '[data-tilt]' })
export class TiltDirective {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const fx = inject(FxService);
    const zone = inject(NgZone);
    afterNextRender(() => {
      if (!fx.finePointer || fx.reducedMotion) {
        return;
      }
      const max = parseFloat(el.getAttribute('data-tilt') ?? '') || 10;
      const base = el.getAttribute('data-tilt-base') ?? '';
      zone.runOutsideAngular(() => {
        el.addEventListener('pointerenter', () => (el.style.transition = 'transform .18s ease-out, box-shadow .6s'));
        el.addEventListener('pointermove', (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          el.style.transform = `${base} rotateX(${((0.5 - py) * max).toFixed(2)}deg) rotateY(${((px - 0.5) * max).toFixed(2)}deg)`;
          el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
          el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        });
        el.addEventListener('pointerleave', () => {
          el.style.transition = '';
          el.style.transform = '';
        });
      });
    });
  }
}

/** Boutons « magnétiques » qui suivent légèrement la souris. */
@Directive({ selector: '.btn, .round-btn, .lb-nav' })
export class MagneticDirective {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const fx = inject(FxService);
    const zone = inject(NgZone);
    afterNextRender(() => {
      if (!fx.finePointer || fx.reducedMotion) {
        return;
      }
      zone.runOutsideAngular(() => {
        el.addEventListener('pointermove', (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2);
          const dy = e.clientY - (r.top + r.height / 2);
          el.style.transform = `translate(${(dx * 0.18).toFixed(1)}px, ${(dy * 0.3).toFixed(1)}px)`;
        });
        el.addEventListener('pointerleave', () => (el.style.transform = ''));
      });
    });
  }
}

/** Titre dont les mots « s'allument » au fil du défilement. */
@Directive({ selector: '[data-highlight]' })
export class HighlightDirective {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const fx = inject(FxService);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const words = splitWords(el);
      words.forEach((w) => {
        w.classList.add('hw');
        if (w.closest('em')) {
          w.classList.add('gold-word');
        }
      });
      if (fx.reducedMotion) {
        words.forEach((w) => w.classList.add('lit'));
        return;
      }
      const win = el.ownerDocument.defaultView!;
      const stop = fx.addTicker(() => {
        const r = el.getBoundingClientRect();
        const vh = win.innerHeight;
        const p = (vh * 0.85 - r.top) / (r.height + vh * 0.35);
        const n = Math.floor(Math.max(0, Math.min(1, p)) * words.length * 1.05);
        words.forEach((w, k) => w.classList.toggle('lit', k < n));
      });
      destroyRef.onDestroy(stop);
    });
  }
}
