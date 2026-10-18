import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FX } from '../core/fx';
import { ContentService } from '../core/content.service';
import { BookingService } from '../core/booking.service';
import { LightboxService } from '../core/lightbox.service';
import { SeoService } from '../core/seo.service';
import { CARD_TAGLINES } from '../core/site';
import { formatPrice } from '../core/format';
import { I18N, I18nService, mark } from '../core/i18n';
import { ArrowComponent, IconComponent, MemberCardComponent, WordmarkComponent } from '../shared/ui';
import { CtaComponent, MarqueeComponent } from '../shared/layout';
import { ReviewsComponent } from '../shared/reviews';

@Component({
  selector: 'app-home',
  imports: [FX, RouterLink, ArrowComponent, IconComponent, MemberCardComponent, WordmarkComponent, CtaComponent, MarqueeComponent, ReviewsComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
})
export class HomePage {
  protected readonly content = inject(ContentService);
  protected readonly booking = inject(BookingService);
  private readonly lightbox = inject(LightboxService);
  private readonly i18n = inject(I18nService);
  protected readonly posts = this.content.instagram;
  protected readonly hero = computed(() => this.content.img('home.hero'));
  protected readonly about = computed(() => this.content.img('home.about'));

  protected readonly marquee = [mark('Spa & massages'), mark('Soins visage'), mark('Coiffure'), mark('Mains & pieds'), mark('Épilation & sourcils')];

  protected readonly features = [
    { icon: 'lotus', title: mark('Soins visage'), text: mark('Des soins haute performance pour une peau éclatante, saine et durable.') },
    { icon: 'sun', title: mark('Spa & massages'), text: mark('Massages signature, sportifs et silhouette pour relâcher les tensions et retrouver votre équilibre.') },
    { icon: 'scissors', title: mark('Coiffure'), text: mark('Couleur, soin et brushing : des cheveux sublimés, du shampoing au coiffage.') },
    { icon: 'diamond', title: mark('Expertise & écoute'), text: mark('Une équipe de professionnelles passionnées à votre service.') },
  ];

  protected readonly cards = computed(() =>
    this.content.categories().map((c) => {
      const prices = c.services.filter((s) => s.price !== null).map((s) => s.price as number);
      const img = this.content.img('card.' + c.slug, { alt: c.title });
      const tagline = CARD_TAGLINES[c.slug];
      return {
        slug: c.slug,
        title: c.title,
        tagline: tagline ? this.i18n.tr(tagline) : c.intro,
        img: img.src,
        alt: img.alt,
        pos: img.pos,
        from: prices.length ? formatPrice({ price: Math.min(...prices), price_from: true }, this.content.settings().currency, this.i18n.lang()) : '',
      };
    }),
  );

  constructor() {
    const seo = inject(SeoService);
    const s = this.content.settings();
    seo.set({
      ...seo.page('/'),
      path: '/',
      jsonLd: [
        seo.business(s),
        { '@context': 'https://schema.org', '@type': 'WebSite', name: 'OPAAL Beauty Club', url: seo.url('/'), inLanguage: this.i18n.siteLang() },
      ],
    });
  }

  protected openPost(index: number): void {
    this.lightbox.open(
      this.posts().map((p) => ({ src: p.src, alt: this.i18n.tr('Publication OPAAL : {caption}', { caption: p.caption }), caption: p.caption })),
      index % this.posts().length,
    );
  }
}
