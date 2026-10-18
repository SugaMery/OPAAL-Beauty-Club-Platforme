import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FX } from '../core/fx';
import { BookingService } from '../core/booking.service';
import { ContentService } from '../core/content.service';
import { fullAddress, telHref, whatsappHref } from '../core/format';
import { ArrowComponent, BurstComponent, MonoComponent, WordmarkComponent } from './ui';
import { NAV } from './header';
import { NewsletterFormComponent } from './forms';
import { I18N, I18nService, mark } from '../core/i18n';

/** Bandeau de texte défilant. */
@Component({
  selector: 'app-marquee',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [I18N],
  template: `<div class="marquee" [class.dark]="dark()" aria-hidden="true"><div class="marquee-track">
    @for (copy of [0, 1]; track copy) {
      <span>
        @for (t of items(); track $index) {
          {{ t | tr }} <svg viewBox="0 0 16 16"><path d="M8 0c.7 4.6 2.4 6.3 8 8-5.6 1.7-7.3 3.4-8 8-.7-4.6-2.4-6.3-8-8 5.6-1.7 7.3-3.4 8-8Z" /></svg>
        }
      </span>
    }
  </div></div>`,
})
export class MarqueeComponent {
  readonly items = input.required<string[]>();
  readonly dark = input(false);
}

/** Bandeau noir « Prenez soin de vous ». */
@Component({
  selector: 'app-cta',
  imports: [FX, MonoComponent, WordmarkComponent, ArrowComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="cta">
    <canvas class="sparkles" data-density=".6" aria-hidden="true"></canvas>
    <div class="container cta-inner">
      <div class="cta-logo draw"><app-mono /><app-wordmark /><span>Beauty Club</span></div>
      <p class="cta-quote" data-split>{{ 'Prenez soin de vous,' | tr }}<br />{{ 'vous le méritez.' | tr }}</p>
      <div data-anim="fade" style="--d: 0.4s">
        <a class="btn btn-outline btn-light" [href]="booking.url()" target="_blank" rel="noopener" (click)="booking.track('Bandeau « Prenez soin de vous »')">{{ 'Réserver un soin' | tr }} <app-arrow /></a>
      </div>
    </div>
  </section>`,
})
export class CtaComponent {
  protected readonly booking = inject(BookingService);
}

/** En-tête des pages intérieures (titre, photo en arche, badge). */
@Component({
  selector: 'app-page-hero',
  imports: [FX, RouterLink, MonoComponent, BurstComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="page-hero">
    <div class="ghost-word" data-parallax-x=".12" aria-hidden="true">{{ ghost() | tr }}</div>
    <div class="container">
      <div>
        <nav class="breadcrumb" data-anim="fade" [attr.aria-label]="'Fil d’Ariane' | tr">
          <a [routerLink]="'/' | lp">{{ 'Accueil' | tr }}</a><i></i><span>{{ crumb() | tr }}</span>
        </nav>
        <p class="eyebrow line" data-anim="fade" style="--d: 0.1s">{{ eyebrow() | tr }}</p>
        <ng-content select="h1" />
        <p class="lead" data-anim="up" style="--d: 0.4s">{{ lead() | tr }}</p>
        <div class="btn-row" data-anim="up" style="--d: 0.55s"><ng-content select="[actions]" /></div>
      </div>
      <div class="arch" data-anim="fade">
        <div class="arch-line"></div>
        <div class="arch-frame" data-anim="mask" style="--d: 0.15s">
          <img [src]="photo().src" [alt]="photo().alt" [attr.data-slot]="slot() || null" data-parallax=".06" [style.object-position]="photo().pos" fetchpriority="high" />
        </div>
        <app-burst />
        <div class="arch-badge" data-anim="right" style="--d: 1s"><app-mono /><span [innerHTML]="badge() | tr"></span></div>
      </div>
    </div>
  </section>`,
})
export class PageHeroComponent {
  private readonly content = inject(ContentService);
  readonly crumb = input.required<string>();
  readonly eyebrow = input.required<string>();
  readonly lead = input.required<string>();
  /** Emplacement d'image modifiable (voir media-slots.ts), ex. « soins.hero ». */
  readonly slot = input('');
  readonly image = input('');
  readonly alt = input('');
  readonly pos = input('center');
  readonly ghost = input('');
  readonly badge = input('');
  protected readonly photo = computed(() =>
    this.slot() ? this.content.img(this.slot()) : { src: this.image(), alt: this.alt(), pos: this.pos() },
  );
}

/** Pied de page. */
@Component({
  selector: 'app-footer',
  imports: [FX, RouterLink, WordmarkComponent, ArrowComponent, MarqueeComponent, NewsletterFormComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-marquee [items]="marquee" />
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid" data-stagger=".1">
          <div class="footer-brand" data-anim="up">
            <app-wordmark /><span class="tagline">Beauty Club</span>
            <p>{{ 'L’art de révéler la lumière qui est en vous.' | tr }}</p>
            <div class="socials">
              @for (s of socials(); track s.label) {
                <a [href]="s.url" target="_blank" rel="noopener">{{ s.label }}</a>
              }
            </div>
          </div>
          <div class="footer-col" data-anim="up">
            <h4>{{ 'Navigation' | tr }}</h4>
            <ul>
              @for (item of nav(); track item.path) {
                <li><a [routerLink]="item.path | lp">{{ item.label | tr }}</a></li>
              }
            </ul>
          </div>
          <div class="footer-col" data-anim="up">
            <h4>{{ 'Nos soins' | tr }}</h4>
            <ul>
              @for (c of content.categories(); track c.slug) {
                <li><a [routerLink]="'/soins' | lp" [fragment]="c.slug">{{ c.title }}</a></li>
              }
              <li><a [routerLink]="'/membership' | lp">{{ 'Le club OPAAL' | tr }}</a></li>
              <li><a [routerLink]="'/carte-cadeau' | lp">{{ 'Carte cadeau' | tr }}</a></li>
              @if (content.reviews().length) {
                <li><a [routerLink]="'/avis' | lp">{{ 'Avis clientes' | tr }}</a></li>
              }
            </ul>
          </div>
          <div class="footer-col" data-anim="up">
            <h4>{{ 'Contact' | tr }}</h4>
            <ul>
              <li><a [href]="tel()">{{ s().phone }}</a></li>
              <li><a [href]="'mailto:' + s().email">{{ s().email }}</a></li>
              <li><a [href]="s().maps_url" target="_blank" rel="noopener">{{ address() }}</a></li>
              <li><a [href]="wa()" target="_blank" rel="noopener">WhatsApp</a></li>
            </ul>
            <a class="btn btn-outline" [href]="booking.url()" target="_blank" rel="noopener" (click)="booking.track('Pied de page')">{{ 'Réserver' | tr }} <app-arrow /></a>
          </div>
        </div>
        <app-newsletter-form />
        <div class="footer-bottom">
          <p>© {{ year }} OPAAL Beauty Club. {{ 'Tous droits réservés.' | tr }}</p>
          <p class="tagline-foot">{{ 'Beauté — Confiance — Excellence' | tr }}</p>
          <p>
            <a [routerLink]="'/mentions-legales' | lp">{{ 'Mentions légales' | tr }}</a><span class="sep">|</span>
            <a [routerLink]="'/mentions-legales' | lp" fragment="conditions">{{ 'Conditions' | tr }}</a><span class="sep">|</span>
            <a [routerLink]="'/mentions-legales' | lp" fragment="confidentialite">{{ 'Confidentialité' | tr }}</a>
          </p>
        </div>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  protected readonly content = inject(ContentService);
  protected readonly booking = inject(BookingService);
  private readonly i18n = inject(I18nService);
  protected readonly nav = computed(() => NAV.filter((i) => i.path !== '/blog' || this.s().has_blog));
  protected readonly marquee = [mark('Beauté'), mark('Confiance'), mark('Excellence'), mark('L’art de révéler la lumière qui est en vous')];
  protected readonly year = new Date().getFullYear();
  protected readonly s = this.content.settings;
  protected readonly address = computed(() => fullAddress(this.s()));
  protected readonly tel = computed(() => telHref(this.s().phone));
  protected readonly wa = computed(() => whatsappHref(this.s(), this.i18n.tr('Bonjour OPAAL Beauty Club !')));
  protected readonly socials = computed(() => {
    const s = this.s();
    return [
      { label: 'Instagram', url: s.instagram },
      { label: 'Facebook', url: s.facebook },
      { label: 'TikTok', url: s.tiktok },
      { label: 'Pinterest', url: s.pinterest },
    ].filter((x) => !!x.url && x.url !== '#');
  });
}
