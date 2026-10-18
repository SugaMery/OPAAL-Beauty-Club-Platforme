import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FX } from '../core/fx';
import { BookingService } from '../core/booking.service';
import { ContentService } from '../core/content.service';
import { SeoService } from '../core/seo.service';
import { I18N, I18nService, mark } from '../core/i18n';
import { ArrowComponent, MonoComponent, WordmarkComponent } from '../shared/ui';
import { CtaComponent, PageHeroComponent } from '../shared/layout';

@Component({
  selector: 'app-about',
  imports: [FX, RouterLink, ArrowComponent, MonoComponent, WordmarkComponent, CtaComponent, PageHeroComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about.html',
})
export class AboutPage {
  protected readonly booking = inject(BookingService);
  protected readonly content = inject(ContentService);

  protected readonly values = [
    { title: mark('Beauté'), text: mark('Une beauté naturelle et lumineuse, qui vous ressemble et vous sublime.') },
    { title: mark('Confiance'), text: mark('Une écoute sincère et des conseils honnêtes, à chaque visite.') },
    { title: mark('Excellence'), text: mark('Des gestes experts et des produits choisis avec exigence.') },
  ];

  protected readonly lieu = computed(() => this.content.img('about.lieu'));

  constructor() {
    const seo = inject(SeoService);
    const i18n = inject(I18nService);
    seo.set({
      ...seo.page('/a-propos'),
      path: '/a-propos',
      breadcrumb: i18n.tr('À propos'),
      jsonLd: [seo.webPage('AboutPage', '/a-propos', i18n.tr('À propos d’OPAAL Beauty Club'), seo.page('/a-propos').description)],
    });
  }
}
