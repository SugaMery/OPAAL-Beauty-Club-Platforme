import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FX } from '../core/fx';
import { PublicApi } from '../core/api.service';
import { BookingService } from '../core/booking.service';
import { SeoService } from '../core/seo.service';
import { BlogPost } from '../core/models';
import { PostContentComponent } from '../shared/post-content';
import { SITE_URL } from '../core/site';
import { I18N, I18nService, Lang } from '../core/i18n';
import { localizePost } from '../core/localize';
import { ArrowComponent } from '../shared/ui';
import { longDate, postPath } from './blog';

/** Article du blog (/blog/mon-article, ou /en/blog/mon-article s'il est traduit). */
@Component({
  selector: 'app-blog-post',
  imports: [FX, RouterLink, ArrowComponent, PostContentComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (post(); as p) {
      <article class="post">
        <header class="post-head">
          <div class="container post-narrow">
            <nav class="breadcrumb" [attr.aria-label]="'Fil d’Ariane' | tr"><a [routerLink]="'/' | lp">{{ 'Accueil' | tr }}</a><i></i><a [routerLink]="'/blog' | lp">{{ 'Blog' | tr }}</a><i></i><span>{{ p.category || ('Article' | tr) }}</span></nav>
            @if (p.category) {<p class="eyebrow line">{{ p.category }}</p>}
            <h1>{{ p.title }}</h1>
            <p class="blog-meta"><time [attr.datetime]="p.published_at?.slice(0, 10)">{{ date(p.published_at) }}</time> · {{ '{n} min de lecture' | tr: { n: p.reading_time } }} · OPAAL Beauty Club</p>
          </div>
        </header>
        @if (p.cover) {
          <div class="container post-cover"><img [src]="p.cover" [alt]="p.cover_alt || p.title" fetchpriority="high" /></div>
        }
        <div class="container post-narrow post-body">
          @if (p.excerpt) {<p class="post-lead">{{ p.excerpt }}</p>}
          <app-post-content [text]="p.content || ''" />

          <aside class="post-cta">
            <p class="eyebrow">{{ 'Prendre soin de vous' | tr }}</p>
            <h2>{{ 'Envie de passer de la lecture au soin ?' | tr }}</h2>
            <p>{{ 'Nos expertes vous accueillent à Amelkis, Marrakech, pour un moment rien que pour vous.' | tr }}</p>
            <div class="btn-row">
              <a class="btn btn-dark" [href]="booking.url()" target="_blank" rel="noopener" (click)="booking.track('Article : ' + p.title)">{{ 'Réserver un soin' | tr }} <app-arrow /></a>
              <a class="link-arrow" [routerLink]="'/soins' | lp">{{ 'Voir la carte des soins' | tr }} <app-arrow /></a>
            </div>
          </aside>
        </div>

        @if (related().length) {
          <section class="section post-related">
            <div class="container">
              <p class="eyebrow center">{{ 'À lire aussi' | tr }}</p>
              <div class="blog-grid three">
                @for (r of related(); track r.id) {
                  <article class="blog-card">
                    <a class="blog-card-img" [routerLink]="link(r)" [attr.aria-label]="r.title"><img [src]="r.cover || 'images/og-opaal.jpg'" [alt]="r.cover_alt || r.title" loading="lazy" /></a>
                    <div class="blog-card-body">
                      <p class="blog-meta">{{ date(r.published_at) }} · {{ r.reading_time }} min</p>
                      <h2><a [routerLink]="link(r)">{{ r.title }}</a></h2>
                    </div>
                  </article>
                }
              </div>
            </div>
          </section>
        }
      </article>
    } @else if (notFound()) {
      <section class="page-hero simple not-found">
        <div class="container center">
          <p class="eyebrow center">{{ 'Blog' | tr }}</p>
          <h1>{{ 'Cet article est introuvable.' | tr }}</h1>
          <p class="lead">{{ 'Il a peut-être été déplacé ou retiré.' | tr }}</p>
          <div class="btn-row center-row"><a class="btn btn-dark" [routerLink]="'/blog' | lp">{{ 'Tous les articles' | tr }} <app-arrow /></a></div>
        </div>
      </section>
    } @else {
      <section class="page-hero simple"><div class="container center"><p class="lead-sm">{{ 'Chargement de l’article…' | tr }}</p></div></section>
    }
  `,
})
export class BlogPostPage {
  private readonly api = inject(PublicApi);
  private readonly seo = inject(SeoService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  protected readonly booking = inject(BookingService);
  protected readonly post = signal<BlogPost | null>(null);
  protected readonly all = signal<BlogPost[]>([]);
  protected readonly notFound = signal(false);
  protected readonly related = computed(() => {
    const p = this.post();
    if (!p) return [];
    const lang = this.i18n.siteLang();
    const others = this.all().filter((x) => x.id !== p.id).map((x) => localizePost(x, lang));
    const ordered = [...others.filter((x) => x.category === p.category), ...others.filter((x) => x.category !== p.category)];
    // Sur le site anglais, les articles traduits d'abord
    return (lang === 'en' ? [...ordered.filter((x) => x.has_en), ...ordered.filter((x) => !x.has_en)] : ordered).slice(0, 3);
  });

  constructor() {
    const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    const sub = inject(ActivatedRoute).paramMap.subscribe((params) => {
      if (isBrowser) void this.load(params.get('slug') ?? '');
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  protected date(value: string | null): string {
    return longDate(value, this.i18n.siteLang());
  }

  protected link(p: BlogPost): string {
    return postPath(p, this.i18n.siteLang());
  }

  private async load(slug: string): Promise<void> {
    this.post.set(null);
    this.notFound.set(false);
    const lang: Lang = this.i18n.siteLang();
    try {
      const raw = await this.api.post(slug);
      if (lang === 'en' && !raw.has_en) {
        // Article pas encore traduit : version française
        void this.router.navigateByUrl('/blog/' + raw.slug, { replaceUrl: true });
        return;
      }
      const p = localizePost(raw, lang);
      this.post.set(p);
      const date = p.published_at?.slice(0, 10) ?? '';
      const image = p.cover || 'images/og-opaal.jpg';
      this.seo.set({
        title: p.seo_title || `${p.title} | OPAAL Beauty Club`,
        description: p.seo_description || p.excerpt,
        path: '/blog/' + p.slug,
        image,
        imageAlt: p.cover_alt || p.title,
        type: 'article',
        published: date,
        breadcrumb: p.title,
        parent: { name: this.i18n.tr('Blog'), path: '/blog' },
        langs: raw.has_en ? ['fr', 'en'] : ['fr'],
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: p.title,
            description: p.seo_description || p.excerpt,
            image: [SITE_URL + '/' + image.replace(/^\//, '')],
            datePublished: date,
            dateModified: p.updated_at?.slice(0, 10) || date,
            mainEntityOfPage: this.seo.url('/blog/' + p.slug),
            inLanguage: lang,
            articleSection: p.category,
            author: { '@type': 'Organization', name: 'OPAAL Beauty Club', url: this.seo.url('/') },
            publisher: { '@type': 'Organization', name: 'OPAAL Beauty Club', logo: { '@type': 'ImageObject', url: SITE_URL + '/images/logo-opaal.png' } },
          },
        ],
      });
      if (!this.all().length) this.all.set(await this.api.blog().catch(() => []));
    } catch {
      this.notFound.set(true);
      this.seo.set({ title: this.i18n.tr('Article introuvable | OPAAL Beauty Club'), description: '', path: '/blog/' + slug, noindex: true, parent: { name: 'Blog', path: '/blog' } });
    }
  }
}
