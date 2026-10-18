import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FX } from '../core/fx';
import { BookingService } from '../core/booking.service';
import { LightboxService } from '../core/lightbox.service';
import { SeoService } from '../core/seo.service';
import { ContentService } from '../core/content.service';
import { SITE_URL } from '../core/site';
import { I18N, I18nService, mark } from '../core/i18n';
import { ArrowComponent } from '../shared/ui';
import { CtaComponent, PageHeroComponent } from '../shared/layout';

interface GalleryItem {
  src: string;
  caption: string;
  cat: string;
  w: number;
  h: number;
}

@Component({
  selector: 'app-gallery',
  imports: [FX, ArrowComponent, CtaComponent, PageHeroComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gallery.html',
})
export class GalleryPage {
  protected readonly booking = inject(BookingService);
  private readonly lightbox = inject(LightboxService);

  private readonly content = inject(ContentService);
  private readonly i18n = inject(I18nService);
  private readonly labels: Record<string, string> = {
    visage: mark('Visage'), corps: mark('Corps'), cheveux: mark('Cheveux'), 'mains-pieds': mark('Mains & pieds'), epilation: mark('Épilation'), lieu: mark('Le lieu'),
  };
  /** Filtres : uniquement les catégories présentes dans la galerie. */
  protected readonly filters = computed(() => [
    { key: 'all', label: mark('Tout') },
    ...Object.keys(this.labels)
      .filter((k) => this.all().some((i) => i.cat === k))
      .map((k) => ({ key: k, label: this.labels[k] })),
  ]);
  protected readonly filter = signal('all');
  /** Incrémenté à chaque changement de filtre pour rejouer l'animation. */
  protected readonly generation = signal(0);

  /** Photos gérées dans l'espace propriétaire (Images du site → Galerie). */
  private readonly all = computed<GalleryItem[]>(() =>
    this.content.gallery().map((i) => ({ src: i.src, caption: i.caption, cat: i.cat, w: i.w ?? 1200, h: i.h ?? 1200 })),
  );

  protected readonly items = computed(() => {
    const f = this.filter();
    return this.all().filter((i) => f === 'all' || i.cat === f);
  });

  constructor() {
    const seo = inject(SeoService);
    seo.set({
      ...seo.page('/galerie'),
      path: '/galerie',
      breadcrumb: this.i18n.tr('Galerie'),
      jsonLd: [
        seo.webPage('ImageGallery', '/galerie', this.i18n.tr('Galerie OPAAL Beauty Club'), seo.page('/galerie').description, {
          image: this.all().map((i) => ({ '@type': 'ImageObject', contentUrl: SITE_URL + '/' + i.src, caption: i.caption })),
        }),
      ],
    });
  }

  protected setFilter(key: string): void {
    this.filter.set(key);
    this.generation.update((g) => g + 1);
  }

  protected open(index: number): void {
    this.lightbox.open(
      this.items().map((i) => ({ src: i.src, alt: i.caption, caption: i.caption })),
      index,
    );
  }
}
