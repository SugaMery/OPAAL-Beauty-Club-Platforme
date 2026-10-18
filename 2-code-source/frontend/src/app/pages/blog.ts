import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FX } from '../core/fx';
import { PublicApi } from '../core/api.service';
import { BookingService } from '../core/booking.service';
import { SeoService } from '../core/seo.service';
import { BlogPost } from '../core/models';
import { SITE_URL } from '../core/site';
import { I18N, I18nService, Lang, localizePath } from '../core/i18n';
import { localizePost } from '../core/localize';
import { ArrowComponent } from '../shared/ui';
import { CtaComponent, PageHeroComponent } from '../shared/layout';

const MONTHS: Record<Lang, string[]> = {
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

/** « 5 octobre 2026 » / « 5 October 2026 » */
export function longDate(value: string | null, lang: Lang = 'fr'): string {
  if (!value) return '';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return y && m && d ? `${d} ${MONTHS[lang][m - 1]} ${y}` : '';
}

/** « octobre 2026 » / « October 2026 » */
export function monthYear(value: string, lang: Lang = 'fr'): string {
  const [y, m] = value.split('-').map(Number);
  return y && m ? `${MONTHS[lang][m - 1]} ${y}` : '';
}

/** Adresse d'un article : version anglaise si l'article est traduit, sinon version française. */
export function postPath(p: BlogPost, lang: Lang): string {
  return localizePath('/blog/' + p.slug, lang === 'en' && p.has_en ? 'en' : 'fr');
}

/** Page Blog : liste des articles publiés (conseils beauté, nouveautés). */
@Component({
  selector: 'app-blog',
  imports: [FX, RouterLink, ArrowComponent, CtaComponent, PageHeroComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-hero crumb="Blog" eyebrow="Le blog OPAAL"
      lead="Conseils de nos expertes, rituels beauté et nouveautés de l’institut : tout pour prendre soin de vous, entre deux rendez-vous."
      slot="blog.hero" ghost="Blog" badge="Conseils<br>& rituels">
      <h1 data-split>{{ '[blog] Conseils' | tr }} <em>{{ 'beauté' | tr }}</em> {{ '& bien-être.' | tr }}</h1>
      <div actions>
        <a class="btn btn-dark btn-shine" [href]="('/blog' | lp) + '#articles'">{{ 'Lire les articles' | tr }} <app-arrow /></a>
        <a class="link-arrow" [href]="booking.url()" target="_blank" rel="noopener" (click)="booking.track('Page Blog')">{{ 'Réserver' | tr }} <app-arrow /></a>
      </div>
    </app-page-hero>

    <section class="section blog-section" id="articles">
      <div class="container">
        @if (categories().length > 1) {
          <div class="filters" role="group" [attr.aria-label]="'Filtrer les articles' | tr">
            <button type="button" class="chip" [class.active]="filter() === ''" (click)="filter.set('')">{{ 'Tous' | tr }}</button>
            @for (c of categories(); track c) {
              <button type="button" class="chip" [class.active]="filter() === c" (click)="filter.set(c)">{{ c }}</button>
            }
          </div>
        }
        @if (loading()) {
          <p class="center lead-sm" aria-busy="true"></p>
        } @else if (visible().length) {
          <div class="blog-grid">
            @for (p of visible(); track p.id; let i = $index) {
              <article class="blog-card" [class.first]="i === 0 && !filter()" [attr.lang]="other(p) ? 'fr' : null">
                <a class="blog-card-img" [routerLink]="link(p)" [attr.aria-label]="p.title">
                  <img [src]="p.cover || 'images/og-opaal.jpg'" [alt]="p.cover_alt || p.title" loading="lazy" />
                </a>
                <div class="blog-card-body">
                  <p class="blog-meta">@if (p.category) {<span>{{ p.category }}</span> · }{{ date(p.published_at) }} · {{ '{n} min de lecture' | tr: { n: p.reading_time } }}@if (other(p)) { · <span class="blog-lang">{{ 'Article en français' | tr }}</span>}</p>
                  <h2><a [routerLink]="link(p)">{{ p.title }}</a></h2>
                  <p>{{ p.excerpt }}</p>
                  <a class="link-arrow" [routerLink]="link(p)">{{ 'Lire l’article' | tr }} <app-arrow /></a>
                </div>
              </article>
            }
          </div>
        } @else {
          <div class="avis-empty">
            <p>{{ 'Nos premiers articles arrivent très bientôt.' | tr }}</p>
            <a class="link-arrow" [routerLink]="'/soins' | lp">{{ 'Découvrir nos soins en attendant' | tr }} <app-arrow /></a>
          </div>
        }
      </div>
    </section>

    <app-cta />
  `,
})
export class BlogPage {
  private readonly api = inject(PublicApi);
  private readonly i18n = inject(I18nService);
  protected readonly booking = inject(BookingService);
  private readonly raw = signal<BlogPost[]>([]);
  /** Articles dans la langue du site : en anglais, les articles traduits d'abord. */
  protected readonly posts = computed(() => {
    const lang = this.i18n.siteLang();
    const list = this.raw().map((p) => localizePost(p, lang));
    return lang === 'en' ? [...list.filter((p) => p.has_en), ...list.filter((p) => !p.has_en)] : list;
  });
  protected readonly loading = signal(true);
  protected readonly filter = signal('');
  protected readonly categories = computed(() => [...new Set(this.posts().map((p) => p.category).filter(Boolean))]);
  protected readonly visible = computed(() => this.posts().filter((p) => !this.filter() || p.category === this.filter()));

  constructor() {
    const seo = inject(SeoService);
    seo.set({
      ...seo.page('/blog'),
      path: '/blog',
      breadcrumb: this.i18n.tr('Blog'),
      jsonLd: [
        seo.webPage('Blog', '/blog', this.i18n.tr('Le blog OPAAL Beauty Club'), seo.page('/blog').description ?? '', {
          publisher: { '@type': 'Organization', name: 'OPAAL Beauty Club', logo: SITE_URL + '/images/logo-opaal.png' },
        }),
      ],
    });
    afterNextRender(async () => {
      try {
        this.raw.set(await this.api.blog());
      } catch {
        /* liste vide */
      } finally {
        this.loading.set(false);
      }
    });
  }

  protected date(value: string | null): string {
    return longDate(value, this.i18n.siteLang());
  }

  /** Article non traduit affiché sur le site anglais (il mène à la version française). */
  protected other(p: BlogPost): boolean {
    return this.i18n.siteLang() === 'en' && !p.has_en;
  }

  protected link(p: BlogPost): string {
    return postPath(p, this.i18n.siteLang());
  }
}
