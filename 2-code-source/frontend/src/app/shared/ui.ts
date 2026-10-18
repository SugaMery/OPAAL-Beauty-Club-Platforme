import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FX } from '../core/fx';
import { I18N } from '../core/i18n';

/** Monogramme « AA » OPAAL (SVG vectoriel, animable). */
@Component({
  selector: 'app-mono',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg [attr.class]="'mono ' + cls()" viewBox="572 672 786 576" aria-hidden="true" focusable="false">
    <line class="bar" pathLength="1" x1="662" y1="1078" x2="1269" y2="1078" stroke="#C8A95D" stroke-width="22" />
    <g fill="none" stroke="currentColor" stroke-width="24" stroke-miterlimit="10">
      <polyline pathLength="1" points="584.2,1280 810,716 1036.3,1280" />
      <polyline pathLength="1" points="894.7,1280 1121,716 1346.8,1280" />
    </g>
  </svg>`,
})
export class MonoComponent {
  readonly cls = input('');
}

/** Logo « OPAAL » (SVG vectoriel, animable). */
@Component({
  selector: 'app-wordmark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg [attr.class]="'wordmark ' + cls()" viewBox="-4 -2 464 104" role="img" aria-label="OPAAL">
    <line class="bar" pathLength="1" x1="215.3" y1="66" x2="352.7" y2="66" stroke="#C8A95D" stroke-width="4.4" />
    <g fill="none" stroke="currentColor" stroke-width="3.4" stroke-miterlimit="12">
      <ellipse pathLength="1" cx="46" cy="50" rx="44" ry="48.3" />
      <path pathLength="1" d="M122 100V1.7H148A25.8 25.8 0 0 1 148 53.3H122" />
      <polyline pathLength="1" points="198,100 248,2 298,100" />
      <polyline pathLength="1" points="270,100 320,2 370,100" />
      <path pathLength="1" d="M404 1.7V98.3H455" />
    </g>
  </svg>`,
})
export class WordmarkComponent {
  readonly cls = input('');
}

/** Flèche des boutons et liens. */
@Component({
  selector: 'app-arrow',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg class="arr" viewBox="0 0 18 10" aria-hidden="true"><path [attr.d]="back() ? 'M18 5H2M6 1 2 5l4 4' : 'M0 5h16M12 1l4 4-4 4'" /></svg>`,
})
export class ArrowComponent {
  readonly back = input(false);
}

const ICONS: Record<string, string> = {
  lotus: '<path d="M24 11c4.5 5 4.5 16 0 23-4.5-7-4.5-18 0-23Z"/><path d="M24 34c-6.5-.5-11.5-6-12-13.5 6 1 10.5 5.5 12 13.5Z"/><path d="M24 34c6.5-.5 11.5-6 12-13.5-6 1-10.5 5.5-12 13.5Z"/><path d="M23 35.5c-8 1.2-14.5-2-18-8 6.5-1 13 1.8 18 8Z"/><path d="M25 35.5c8 1.2 14.5-2 18-8-6.5-1-13 1.8-18 8Z"/>',
  eye: '<path d="M5 26c5-7.5 11.5-11 19-11s14 3.5 19 11c-5 7.5-11.5 11-19 11S10 33.5 5 26Z"/><circle cx="24" cy="26" r="6.5"/><circle class="fill" cx="24" cy="26" r="2"/><path d="M13 17.5 10.5 13M18.5 15.5 17.5 10.5M24 15V9.5M29.5 15.5l1-5M35 17.5l2.5-4.5"/>',
  sun: '<circle class="fill" cx="24" cy="24" r="4.5"/><path d="M24 5v8M24 35v8M5 24h8M35 24h8M10.6 10.6l5.6 5.6M31.8 31.8l5.6 5.6M37.4 10.6l-5.6 5.6M16.2 31.8l-5.6 5.6"/><path class="thin" d="M16.7 6.4l1.9 4.6M29.4 37l1.9 4.6M6.4 31.3l4.6-1.9M37 18.6l4.6-1.9M31.3 6.4 29.4 11M18.6 37l-1.9 4.6M6.4 16.7 11 18.6M37 29.4l4.6 1.9"/>',
  diamond: '<path d="M14 13h20l8 9-18 18L6 22Z"/><path d="M6 22h36M19.5 13 16 22l8 18 8-18-3.5-9M16 22l8-9 8 9"/>',
  gift: '<rect x="9" y="20" width="30" height="20" rx="1"/><rect x="7" y="14" width="34" height="6" rx="1"/><path d="M24 14v26"/><path d="M24 14c-3-6-11-7-10-2 .8 3 10 2 10 2Z"/><path d="M24 14c3-6 11-7 10-2-.8 3-10 2-10 2Z"/>',
  sparkle: '<path d="M22 6c1.6 9 4.2 11.6 13 13-8.8 1.4-11.4 4-13 13-1.6-9-4.2-11.6-13-13 8.8-1.4 11.4-4 13-13Z"/><path d="M37 29c.7 3.6 1.7 4.6 5 5-3.3.4-4.3 1.4-5 5-.7-3.6-1.7-4.6-5-5 3.3-.4 4.3-1.4 5-5Z"/>',
  calendar: '<rect x="8" y="11" width="32" height="29" rx="2"/><path d="M8 19h32M16 7v8M32 7v8"/><path d="M18 29.5l4 4 8-8"/>',
  heart: '<path d="M24 39S8 29.5 8 19a8 8 0 0 1 16-2 8 8 0 0 1 16 2c0 10.5-16 20-16 20Z"/><path class="thin" d="M15 19a4 4 0 0 1 4-4"/>',
  crown: '<path d="M9 34 6 16l10 8 8-12 8 12 10-8-3 18Z"/><path d="M9 39h30"/><circle class="fill" cx="24" cy="26" r="1.8"/>',
  phone: '<path d="M15 7l5 7-3.5 3.5a19 19 0 0 0 9 9L29 23l7 5-2.5 6c-12 1-26-13-25-25Z"/>',
  chat: '<path d="M10 37l2.4-6.6A14 14 0 1 1 17 35Z"/><path class="thin" d="M17 22h14M17 27h9"/>',
  mail: '<rect x="7" y="12" width="34" height="24" rx="1"/><path d="M7 13l17 13 17-13"/>',
  pin: '<path d="M24 42s-13-12-13-22a13 13 0 0 1 26 0c0 10-13 22-13 22Z"/><circle cx="24" cy="20" r="5"/>',
  clock: '<circle cx="24" cy="24" r="16"/><path d="M24 14v10l7 5"/>',
  scissors: '<circle cx="14" cy="34" r="5"/><circle cx="14" cy="14" r="5"/><path d="M18 17.5 40 36M18 30.5 40 12"/>',
  nail: '<path d="M18 8h12a2 2 0 0 1 2 2v12H16V10a2 2 0 0 1 2-2Z"/><path d="M14 22h20l-2 18a3 3 0 0 1-3 2.6H19a3 3 0 0 1-3-2.6Z"/><path class="thin" d="M20 28v8"/>',
};

interface Shape { tag: string; a: Record<string, string>; }

/** Convertit le balisage constant ci-dessus en formes (rendu sans innerHTML, compatible pré-rendu). */
const SHAPES: Record<string, Shape[]> = Object.fromEntries(
  Object.entries(ICONS).map(([k, v]) => [
    k,
    [...v.matchAll(/<(\w+)([^>]*)\/>/g)].map((m) => ({
      tag: m[1],
      a: Object.fromEntries([...m[2].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]])),
    })),
  ]),
);

/** Icône dorée dans un cercle (le tracé se dessine à l'apparition). */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="icon-ring"><svg class="draw" viewBox="0 0 48 48" aria-hidden="true">
    @for (s of shapes(); track $index) {
      @switch (s.tag) {
        @case ('circle') {
          <circle [attr.class]="s.a['class'] ?? null" [attr.pathLength]="s.a['class'] === 'fill' ? null : 1"
            [attr.cx]="s.a['cx']" [attr.cy]="s.a['cy']" [attr.r]="s.a['r']" />
        }
        @case ('rect') {
          <rect [attr.class]="s.a['class'] ?? null" pathLength="1" [attr.x]="s.a['x']" [attr.y]="s.a['y']"
            [attr.width]="s.a['width']" [attr.height]="s.a['height']" [attr.rx]="s.a['rx'] ?? null" />
        }
        @default {
          <path [attr.class]="s.a['class'] ?? null" [attr.pathLength]="s.a['class'] === 'fill' ? null : 1" [attr.d]="s.a['d']" />
        }
      }
    }
  </svg></div>`,
})
export class IconComponent {
  readonly name = input.required<string>();
  protected readonly shapes = computed(() => SHAPES[this.name()] ?? []);
}

/** Soleil doré qui tourne (décor des en-têtes de page). */
@Component({
  selector: 'app-burst',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="burst" aria-hidden="true"><svg viewBox="0 0 100 100">
    <circle class="fill" cx="50" cy="50" r="5.5" />
    @for (l of lines; track $index) {
      <line [attr.x1]="l[0]" [attr.y1]="l[1]" [attr.x2]="l[2]" [attr.y2]="l[3]" />
    }
  </svg></div>`,
})
export class BurstComponent {
  protected readonly lines = Array.from({ length: 24 }, (_, i) => {
    const a = (i * Math.PI) / 12;
    const [r1, r2] = i % 2 === 0 ? [13, 46] : [15, 34];
    return [50 + r1 * Math.cos(a), 50 + r1 * Math.sin(a), 50 + r2 * Math.cos(a), 50 + r2 * Math.sin(a)].map((v) => v.toFixed(1));
  });
}

/** Étoiles de notation. */
@Component({
  selector: 'app-stars',
  imports: [I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="stars" [attr.aria-label]="'{n} sur 5' | tr: { n: rating() }" role="img">
    @for (i of five; track i) {<span [class.on]="i <= rating()" aria-hidden="true">★</span>}
  </span>`,
})
export class StarsComponent {
  readonly rating = input(5);
  protected readonly five = [1, 2, 3, 4, 5];
}

/** Carte membre OPAAL en 3D. */
@Component({
  selector: 'app-member-card',
  imports: [FX, MonoComponent, WordmarkComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="member-card" data-tilt="16" data-tilt-base="rotate(-7deg)">
    <span class="mc-chip"></span>
    <app-mono cls="mc-mono" />
    <app-wordmark cls="mc-word" />
    <span class="mc-tag">Beauty Club</span>
    <span class="mc-label">{{ 'Carte membre' | tr }}</span>
  </div>`,
})
export class MemberCardComponent {}

/** Carte noire des résidents d'Amelkis III (−10 %). */
@Component({
  selector: 'app-resident-card',
  imports: [FX, WordmarkComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="member-card dark-card" data-tilt="16" data-tilt-base="rotate(5deg)">
    <div class="dc-top"><span class="dc-chip"></span><app-wordmark cls="dc-word" /></div>
    <div class="dc-bottom">
      <span class="dc-label">{{ 'Carte Résident · Amelkis III' | tr }}</span>
      <span class="dc-big">−10<small>%</small></span>
      <span class="dc-note">{{ 'Sur toutes les prestations · hors produits' | tr }}</span>
    </div>
  </div>`,
})
export class ResidentCardComponent {}

/** Carte cadeau OPAAL. */
@Component({
  selector: 'app-gift-card',
  imports: [FX, MonoComponent, WordmarkComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="member-card dark-card gift" data-tilt="16" data-tilt-base="rotate(-6deg)">
    <div class="dc-top"><app-mono cls="dc-mono" /><app-wordmark cls="dc-word" /></div>
    <div class="dc-bottom">
      <span class="dc-label">{{ 'Carte cadeau' | tr }}</span>
      @if (to()) {
        <span class="dc-gift" [class.long]="to().length > 16" [class.longer]="to().length > 26" [title]="to()">{{ 'Pour' | tr }} <em>{{ to() }}</em></span>
      } @else {
        <span class="dc-gift">{{ 'Offrez un moment' | tr }} <em>OPAAL</em></span>
      }
      <span class="dc-note">{{ value() || 'Beauty Club · Marrakech' }}</span>
    </div>
  </div>`,
})
export class GiftCardComponent {
  /** Personnalisation (aperçu du formulaire) : personne choisie et montant ou soin offert. */
  readonly to = input('');
  readonly value = input('');
}
