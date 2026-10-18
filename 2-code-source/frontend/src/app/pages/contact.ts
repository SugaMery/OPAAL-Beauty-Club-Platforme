import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { FX } from '../core/fx';
import { ContentService } from '../core/content.service';
import { BookingService } from '../core/booking.service';
import { SeoService } from '../core/seo.service';
import { fullAddress, telHref, whatsappHref } from '../core/format';
import { ArrowComponent, IconComponent } from '../shared/ui';
import { PageHeroComponent } from '../shared/layout';
import { ContactFormComponent } from '../shared/forms';
import { I18N, I18nService } from '../core/i18n';

@Component({
  selector: 'app-contact',
  imports: [FX, ArrowComponent, IconComponent, PageHeroComponent, ContactFormComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contact.html',
})
export class ContactPage {
  protected readonly content = inject(ContentService);
  protected readonly booking = inject(BookingService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly i18n = inject(I18nService);
  protected readonly s = this.content.settings;
  protected readonly address = computed(() => fullAddress(this.s()));
  protected readonly tel = computed(() => telHref(this.s().phone));
  protected readonly wa = computed(() => whatsappHref(this.s(), this.i18n.tr('Bonjour OPAAL Beauty Club, je souhaite prendre rendez-vous.')));
  /** Carte Google Maps (adresse française du salon, encodée ; carte dans la langue du site). */
  protected readonly map = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(
      'https://maps.google.com/maps?q=' + encodeURIComponent(fullAddress(this.content.rawSettings())) + '&z=15&output=embed&hl=' + this.i18n.siteLang(),
    ),
  );
  protected readonly socials = computed(() =>
    [
      { label: 'Instagram', url: this.s().instagram },
      { label: 'Facebook', url: this.s().facebook },
      { label: 'TikTok', url: this.s().tiktok },
      { label: 'Pinterest', url: this.s().pinterest },
    ].filter((x) => !!x.url && x.url !== '#'),
  );

  constructor() {
    const seo = inject(SeoService);
    const s = this.content.settings();
    seo.set({
      ...seo.page('/contact'),
      path: '/contact',
      breadcrumb: this.i18n.tr('Contact'),
      jsonLd: [seo.business(s), seo.webPage('ContactPage', '/contact', this.i18n.tr('Contact OPAAL Beauty Club'), seo.page('/contact').description ?? '')],
    });
  }
}
