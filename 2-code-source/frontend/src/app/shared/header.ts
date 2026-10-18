import { ChangeDetectionStrategy, Component, DOCUMENT, computed, effect, inject, input, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FxService } from '../core/fx';
import { FX } from '../core/fx';
import { BookingService } from '../core/booking.service';
import { ContentService } from '../core/content.service';
import { telHref } from '../core/format';
import { I18N, I18nService, LANGS, LANG_NAMES, mark } from '../core/i18n';
import { SeoService } from '../core/seo.service';
import { ArrowComponent, WordmarkComponent } from './ui';

export const NAV = [
  { path: '/', label: mark('Accueil') },
  { path: '/soins', label: mark('Soins') },
  { path: '/membership', label: mark('Membership') },
  { path: '/a-propos', label: mark('À propos') },
  { path: '/galerie', label: mark('Galerie') },
  { path: '/blog', label: mark('Blog') },
  { path: '/contact', label: mark('Contact') },
];

/** Sélecteur de langue FR | EN (affiché si l'anglais est activé dans l'espace propriétaire). */
@Component({
  selector: 'app-lang-switch',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (content.englishEnabled()) {
      <nav class="lang-switch" [class.large]="large()" [attr.aria-label]="i18n.tr('Langue')">
        @for (l of langs; track l; let last = $last) {
          <a [routerLink]="seo.switchUrl(l)" [class.active]="i18n.siteLang() === l" [attr.aria-current]="i18n.siteLang() === l ? 'true' : null"
             [attr.hreflang]="l" [attr.lang]="l" [attr.title]="names[l]">{{ l.toUpperCase() }}</a>
          @if (!last) {<i aria-hidden="true"></i>}
        }
      </nav>
    }
  `,
})
export class LangSwitchComponent {
  readonly large = input(false);
  protected readonly content = inject(ContentService);
  protected readonly seo = inject(SeoService);
  protected readonly i18n = inject(I18nService);
  protected readonly langs = LANGS;
  protected readonly names = LANG_NAMES;
}

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, WordmarkComponent, ArrowComponent, FX, I18N, LangSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    @if (content.settings().announcement || content.settings().instagram) {
      <div class="announce">
        @if (content.settings().announcement) {<span>{{ content.settings().announcement }}</span>}
        @if (content.settings().instagram) {
          <a class="announce-ig" [href]="content.settings().instagram" target="_blank" rel="noopener" [attr.aria-label]="'OPAAL Beauty Club sur Instagram' | tr">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4.2" /><circle class="dot" cx="17.4" cy="6.6" r="1" /></svg>{{ igHandle() }}
          </a>
        }
      </div>
    }
    <header class="site-header" [class.scrolled]="fx.scrolled()" [class.hide]="fx.headerHidden() && !open()">
      <div class="container header-inner">
        <a class="brand" [routerLink]="'/' | lp" [attr.aria-label]="'OPAAL Beauty Club — accueil' | tr">
          <app-wordmark />
          <span>Beauty Club</span>
        </a>
        <nav class="main-nav" [attr.aria-label]="'Navigation principale' | tr">
          @for (item of nav(); track item.path) {
            <a [routerLink]="item.path | lp" routerLinkActive="is-active" ariaCurrentWhenActive="page"
               [routerLinkActiveOptions]="{ exact: item.path === '/' }">
              <span [attr.data-t]="item.label | tr">{{ item.label | tr }}</span>
            </a>
          }
        </nav>
        <div class="header-actions">
          <app-lang-switch />
          <a class="header-gift" [routerLink]="'/carte-cadeau' | lp" routerLinkActive="is-active">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="9" width="17" height="11.5" rx="1" /><path d="M2.5 9h19v-3h-19zM12 6v14.5M12 6c-1.5-3.5-6-3.5-5 0M12 6c1.5-3.5 6-3.5 5 0" /></svg>{{ 'Carte cadeau' | tr }}
          </a>
          <a class="btn btn-outline btn-sm btn-shine" [href]="booking.url()" target="_blank" rel="noopener" (click)="booking.track('En-tête')">{{ 'Réserver' | tr }}</a>
          <button type="button" class="burger" [attr.aria-expanded]="open()" aria-controls="menu"
                  [attr.aria-label]="(open() ? 'Fermer le menu' : 'Ouvrir le menu') | tr" (click)="toggle()">
            <span></span><span></span>
          </button>
        </div>
      </div>
    </header>

    <div class="menu" id="menu" [attr.aria-hidden]="!open()" [attr.inert]="open() ? null : ''">
      <nav [attr.aria-label]="'Menu mobile' | tr">
        @for (item of nav(); track item.path; let i = $index) {
          <a [routerLink]="item.path | lp" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: item.path === '/' }"
             [style.--i]="i"><small>0{{ i + 1 }}</small>{{ item.label | tr }}</a>
        }
      </nav>
      <div class="menu-foot">
        <a class="btn btn-dark" [href]="booking.url()" target="_blank" rel="noopener" (click)="booking.track('Menu mobile'); close()">{{ 'Réserver un soin' | tr }} <app-arrow /></a>
        <a class="btn btn-outline" [routerLink]="'/carte-cadeau' | lp">{{ 'Carte cadeau' | tr }} <app-arrow /></a>
        <app-lang-switch [large]="true" />
        <a [href]="tel()">{{ content.settings().phone }}</a>
        @if (content.settings().instagram) {
          <a [href]="content.settings().instagram" target="_blank" rel="noopener">Instagram</a>
        }
      </div>
    </div>
  `,
})
export class HeaderComponent {
  protected readonly fx = inject(FxService);
  protected readonly booking = inject(BookingService);
  protected readonly content = inject(ContentService);
  private readonly doc = inject(DOCUMENT);
  /** Le lien « Blog » n'apparaît qu'une fois un article publié. */
  protected readonly nav = computed(() => NAV.filter((i) => i.path !== '/blog' || this.content.settings().has_blog));
  protected readonly open = signal(false);
  /** « @opaalbeautyclub » d'après l'adresse du compte Instagram. */
  protected readonly igHandle = computed(() => {
    const m = (this.content.settings().instagram || '').match(/instagram\.com\/([^/?#]+)/i);
    return m ? '@' + m[1] : 'Instagram';
  });

  constructor() {
    inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.close();
      }
    });
    effect(() => {
      const open = this.open();
      if (this.fx.isBrowser) {
        this.doc.body.classList.toggle('menu-open', open);
        this.fx.setMenuOpen(open);
      }
    });
    effect(() => {
      const hidden = this.fx.headerHidden();
      if (this.fx.isBrowser) {
        this.doc.body.classList.toggle('header-hidden', hidden);
      }
    });
  }

  protected tel(): string {
    return telHref(this.content.settings().phone);
  }

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  close(): void {
    this.open.set(false);
  }
}
