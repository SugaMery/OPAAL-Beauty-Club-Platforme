import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FX } from '../core/fx';
import { ContentService } from '../core/content.service';
import { SeoService } from '../core/seo.service';
import { REVIEW_SOURCES } from '../core/models';
import { I18N, I18nService, mark } from '../core/i18n';
import { StarsComponent } from '../shared/ui';
import { ReviewFormComponent } from '../shared/reviews';
import { monthYear } from './blog';

const PAGE = 12;

/**
 * Page « Avis clientes » : tous les avis publiés + formulaire.
 * Lien à envoyer aux clientes : /avis?prenom=Sarah&soin=Soin%20éclat (champs pré-remplis).
 */
@Component({
  selector: 'app-avis',
  imports: [FX, RouterLink, StarsComponent, ReviewFormComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-hero simple">
      <div class="ghost-word" data-parallax-x=".12" aria-hidden="true">{{ 'Avis' | tr }}</div>
      <div class="container">
        <div>
          <nav class="breadcrumb" data-anim="fade" [attr.aria-label]="'Fil d’Ariane' | tr"><a [routerLink]="'/' | lp">{{ 'Accueil' | tr }}</a><i></i><span>{{ 'Avis clientes' | tr }}</span></nav>
          <p class="eyebrow line" data-anim="fade" style="--d: 0.1s">{{ 'Avis clientes' | tr }}</p>
          <h1 data-split>{{ 'Vos mots, notre' | tr }} <em>{{ 'plus belle' | tr }}</em> {{ 'récompense.' | tr }}</h1>
          @if (reviews().length) {
            <p class="rating-summary left" data-anim="fade" style="--d: 0.3s"><app-stars [rating]="rounded()" /> <span>{{ average() }} / 5 · {{ (reviews().length === 1 ? '1 avis' : '{n} avis') | tr: { n: reviews().length } }}</span></p>
          }
        </div>
      </div>
    </section>

    <section class="section avis-section">
      <div class="container avis-grid">
        <div class="panel avis-form" id="laisser-un-avis" data-anim="up">
          <p class="eyebrow">{{ 'Votre avis' | tr }}</p>
          @if (prenom()) {
            <h2>{{ 'Merci {name} pour votre visite !' | tr: { name: prenom() } }}</h2>
            <p class="lead-sm">{{ 'Comment s’est passé votre moment chez OPAAL ? Votre avis nous aide à progresser et guide d’autres clientes.' | tr }}</p>
          } @else {
            <h2>{{ 'Partagez votre expérience' | tr }}</h2>
            <p class="lead-sm">{{ 'Vous êtes venue chez OPAAL ? Une note et quelques mots suffisent : votre avis aide d’autres clientes à nous découvrir.' | tr }}</p>
          }
          <div style="height: 18px"></div>
          <app-review-form [prefillName]="prenom()" [prefillService]="soin()" />
        </div>

        <div class="avis-list" id="tous-les-avis">
          @if (reviews().length) {
            <div class="avis-filters" role="group" [attr.aria-label]="'Filtrer les avis' | tr">
              @for (f of filters(); track f.key) {
                <button type="button" class="chip" [class.active]="filter() === f.key" (click)="setFilter(f.key)">{{ f.label | tr }} <b>{{ f.n }}</b></button>
              }
            </div>
            <div class="avis-cards">
              @for (r of visible(); track r.id) {
                <article class="avis-card">
                  <header>
                    <app-stars [rating]="r.rating" />
                    @if (r.source && r.source !== 'site') {<span class="avis-src">{{ 'Avis {source}' | tr: { source: source(r.source) } }}</span>}
                  </header>
                  <p>{{ r.text }}</p>
                  <footer><b>{{ r.name }}</b>@if (r.service) {<span> · {{ r.service }}</span>}<time [attr.datetime]="r.date">{{ month(r.date) }}</time></footer>
                </article>
              }
            </div>
            @if (filtered().length > shown()) {
              <div class="center" style="margin-top: 30px"><button type="button" class="btn btn-outline" (click)="shown.set(shown() + page)">{{ 'Voir plus d’avis ({n})' | tr: { n: filtered().length - shown() } }}</button></div>
            }
          } @else {
            <div class="avis-empty">
              <app-stars [rating]="5" />
              <p>{{ 'Soyez la première à partager votre expérience OPAAL.' | tr }}</p>
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class AvisPage {
  private readonly content = inject(ContentService);
  private readonly i18n = inject(I18nService);
  private readonly params = toSignal(inject(ActivatedRoute).queryParamMap);
  protected readonly page = PAGE;
  protected readonly prenom = computed(() => (this.params()?.get('prenom') ?? '').trim().slice(0, 60));
  protected readonly soin = computed(() => (this.params()?.get('soin') ?? '').trim().slice(0, 120));
  protected readonly reviews = this.content.reviews;
  protected readonly average = computed(() => this.content.averageRating().toLocaleString(this.i18n.locale()));
  protected readonly rounded = computed(() => Math.round(this.content.averageRating()));
  protected readonly filter = signal<'all' | 5 | 4 | 'low'>('all');
  protected readonly shown = signal(PAGE);
  protected readonly filters = computed(() => {
    const r = this.reviews();
    return [
      { key: 'all' as const, label: mark('Tous'), n: r.length },
      { key: 5 as const, label: '★★★★★', n: r.filter((x) => x.rating === 5).length },
      { key: 4 as const, label: '★★★★', n: r.filter((x) => x.rating === 4).length },
      { key: 'low' as const, label: mark('3 ★ et moins'), n: r.filter((x) => x.rating <= 3).length },
    ].filter((f) => f.key === 'all' || f.n > 0);
  });
  protected readonly filtered = computed(() => {
    const f = this.filter();
    return this.reviews().filter((r) => f === 'all' || (f === 'low' ? r.rating <= 3 : r.rating === f));
  });
  protected readonly visible = computed(() => this.filtered().slice(0, this.shown()));

  constructor() {
    const seo = inject(SeoService);
    seo.set({
      ...seo.page('/avis'),
      path: '/avis',
      breadcrumb: this.i18n.tr('Avis clientes'),
      jsonLd: [seo.webPage('WebPage', '/avis', this.i18n.tr('Avis clientes OPAAL Beauty Club'), seo.page('/avis').description ?? '')],
    });
  }

  protected setFilter(f: 'all' | 5 | 4 | 'low'): void {
    this.filter.set(f);
    this.shown.set(PAGE);
  }

  protected source(key: string): string {
    return this.i18n.tr(REVIEW_SOURCES[key] || key);
  }

  protected month(date: string): string {
    return monthYear(date, this.i18n.siteLang());
  }
}
