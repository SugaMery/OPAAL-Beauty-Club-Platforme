import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FX } from '../core/fx';
import { ContentService } from '../core/content.service';
import { BookingService } from '../core/booking.service';
import { SeoService } from '../core/seo.service';
import { ArrowComponent, IconComponent, MemberCardComponent, ResidentCardComponent, MonoComponent } from '../shared/ui';
import { CtaComponent } from '../shared/layout';
import { RouterLink } from '@angular/router';
import { I18N, I18nService, mark } from '../core/i18n';

@Component({
  selector: 'app-membership',
  imports: [FX, RouterLink, ArrowComponent, IconComponent, MemberCardComponent, ResidentCardComponent, MonoComponent, CtaComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './membership.html',
})
export class MembershipPage {
  protected readonly content = inject(ContentService);
  protected readonly booking = inject(BookingService);
  private readonly i18n = inject(I18nService);
  protected readonly openFaq = signal<number | null>(null);

  protected readonly benefits = [
    { icon: 'gift', title: mark('Avantages exclusifs'), text: mark('Des attentions réservées aux membres, tout au long de l’année.') },
    { icon: 'sparkle', title: mark('Soins privilégiés'), text: mark('Un accès privilégié à nos soins et à nos nouveautés.') },
    { icon: 'calendar', title: mark('Réservation prioritaire'), text: mark('Vos créneaux préférés, réservés en priorité.') },
    { icon: 'heart', title: mark('Suivi personnalisé'), text: mark('Une équipe qui connaît votre peau et vos envies.') },
    { icon: 'diamond', title: mark('Expérience sur-mesure'), text: mark('Des rituels adaptés à vous, à chaque visite.') },
    { icon: 'crown', title: mark('Moments privilèges'), text: mark('Des instants rien que pour vous, pour prendre soin de soi.') },
  ];

  protected readonly steps = [
    { title: mark('Faites votre demande'), text: mark('Sur WhatsApp ou par téléphone, en quelques secondes.') },
    { title: mark('Rencontrons-nous'), text: mark('Nous faisons connaissance et définissons ensemble vos envies.') },
    { title: mark('Profitez du club'), text: mark('Vos avantages membres vous accompagnent toute l’année.') },
  ];

  protected readonly faqs = [
    { q: mark('Comment devenir membre ?'), a: mark('Cliquez sur « Devenir membre » pour nous écrire sur WhatsApp, ou appelez-nous. Nous vous présentons les formules et répondons à toutes vos questions.') },
    { q: mark('Quelle formule choisir ?'), a: mark('Chaque formule est pensée pour un rythme différent. Nous vous conseillons lors de votre premier rendez-vous, selon vos besoins et vos envies.') },
    { q: mark('Comment réserver un soin en tant que membre ?'), a: mark('Comme d’habitude, via notre agenda en ligne (bouton « Réserver »), par téléphone ou sur WhatsApp : précisez simplement que vous êtes membre du club OPAAL.') },
  ];

  constructor() {
    const seo = inject(SeoService);
    seo.set({
      ...seo.page('/membership'),
      path: '/membership',
      breadcrumb: this.i18n.tr('Membership'),
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          inLanguage: this.i18n.siteLang(),
          mainEntity: this.faqs.map((f) => ({ '@type': 'Question', name: this.i18n.tr(f.q), acceptedAnswer: { '@type': 'Answer', text: this.i18n.tr(f.a) } })),
        },
      ],
    });
  }

  protected toggle(i: number): void {
    this.openFaq.update((v) => (v === i ? null : i));
  }
}
