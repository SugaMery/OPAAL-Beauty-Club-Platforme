import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DOCUMENT, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { FX, FxService } from '../core/fx';
import { ContentService } from '../core/content.service';
import { BookingService } from '../core/booking.service';
import { SeoService } from '../core/seo.service';
import { formatDuration } from '../core/format';
import { BlogPost, Service } from '../core/models';
import { PublicApi } from '../core/api.service';
import { localizePost } from '../core/localize';
import { I18N, I18nService, localizePath, mark } from '../core/i18n';
import { RouterLink } from '@angular/router';
import { ArrowComponent } from '../shared/ui';
import { CtaComponent, PageHeroComponent } from '../shared/layout';

interface MenuItem {
  id: number;
  name: string;
  description: string;
  variants: { prefix: string; amount: string; currency: string; duration: string }[];
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
  /** Suite d'une rubrique commencée dans la colonne précédente. */
  cont?: boolean;
}

@Component({
  selector: 'app-soins',
  imports: [FX, RouterLink, ArrowComponent, CtaComponent, PageHeroComponent, I18N, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './soins.html',
})
export class SoinsPage {
  protected readonly content = inject(ContentService);
  protected readonly booking = inject(BookingService);
  private readonly fx = inject(FxService);
  private readonly doc = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);
  protected readonly active = signal(0);
  protected readonly duration = (m: number | null) => formatDuration(m, this.i18n.lang());

  protected readonly blocks = computed(() =>
    this.content.categories().map((c, i) => {
      const prices = c.services.filter((s) => s.price !== null).map((s) => s.price as number);
      return {
        ...c,
        num: String(i + 1).padStart(2, '0'),
        img: this.content.img('cat.' + c.slug, { alt: c.title }),
        arched: i % 2 === 0,
        ...this.columns(this.group(c.services), c.services.length <= 6 ? 1 : 2),
        from: prices.length ? this.content.price({ price: Math.min(...prices), price_from: true }) : '',
      };
    }),
  );

  /**
   * Carte d'une catégorie : soins classés par rubrique ; les lignes consécutives d'un même soin
   * (ex. massage 60 min et 90 min) sont réunies, avec un prix par durée.
   */
  private group(services: Service[]): MenuGroup[] {
    const groups: MenuGroup[] = [];
    for (const s of services) {
      const title = (s.grp ?? '').trim();
      let g = groups.at(-1);
      if (!g || g.title !== title) {
        g = { title, items: [] };
        groups.push(g);
      }
      const variant = { ...this.priceParts(s), duration: this.duration(s.duration) };
      const last = g.items.at(-1);
      if (last && last.name === s.name) {
        last.variants.push(variant);
        last.description ||= s.description;
      } else {
        g.items.push({ id: s.id, name: s.name, description: s.description, variants: [variant] });
      }
    }
    return groups;
  }

  /**
   * Répartit la carte en colonnes de hauteur proche, dans l'ordre ; une rubrique coupée
   * reprend son titre en haut de la colonne suivante.
   */
  private columns(groups: MenuGroup[], count: number): { left: MenuGroup[]; right: MenuGroup[] } {
    if (count === 1) return { left: groups, right: [] };
    const weight = (it: MenuItem) => 1 + (it.description ? 0.4 + it.description.length / 160 : 0) + (it.variants.length - 1) * 0.45;
    const groupWeight = (g: MenuGroup) => (g.title ? 0.7 : 0) + g.items.reduce((n, it) => n + weight(it), 0);
    const half = groups.reduce((n, g) => n + groupWeight(g), 0) / 2;
    const left: MenuGroup[] = [];
    const right: MenuGroup[] = [];
    let acc = 0;
    for (const g of groups) {
      if (acc >= half) {
        right.push(g);
        continue;
      }
      acc += g.title ? 0.7 : 0;
      const stay: MenuItem[] = [];
      const move: MenuItem[] = [];
      for (const it of g.items) {
        const w = weight(it);
        // l'élément reste à gauche s'il y tient mieux que dans la colonne de droite
        if (!move.length && acc + w / 2 <= half) {
          stay.push(it);
          acc += w;
        } else {
          move.push(it);
        }
      }
      if (stay.length) left.push({ title: g.title, items: stay });
      if (move.length) right.push({ title: g.title, items: move, cont: stay.length > 0 });
      if (move.length) acc = half;
    }
    return { left, right };
  }

  /** « À partir de » / « 1 350 » / « DH » séparés pour la mise en forme. */
  private priceParts(s: Service): { prefix: string; amount: string; currency: string } {
    const text = this.content.price(s);
    if (s.price === null) return { prefix: '', amount: text, currency: '' };
    const m = text.match(/^(.*?)(\d[\d\s ,.]*)\s(\S+)$/);
    return m ? { prefix: m[1].trim(), amount: m[2], currency: m[3] } : { prefix: '', amount: text, currency: '' };
  }

  protected readonly partners = [
    { cat: mark('Soins du visage'), name: 'VIE Collection', url: 'https://www.viecollection.com/fr/', logo: 'images/marques/vie-collection.png', h: 58, post: 'vie-collection-soins-visage',
      text: mark('Des soins visage professionnels haute performance, personnalisés après un diagnostic de peau. Les produits VIE Collection sont aussi disponibles à la vente au salon.') },
    { cat: mark('Couleur & soins capillaires'), name: 'L’Oréal Professionnel', url: 'https://www.lorealprofessionnel.fr', logo: 'images/marques/loreal-professionnel.png', h: 50, post: 'loreal-professionnel-couleur-soins',
      text: mark('Coloration et soins experts : Metal Detox, Absolut Repair, Curl Expression et Sérioxyl.') },
    { cat: mark('Lissages & soins'), name: 'Myriam K', url: 'https://www.myriamkparis.com/', logo: 'images/marques/myriam-k.png', h: 30, post: 'myriam-k-lissages',
      text: mark('Lissages brésilien et français, soins des boucles et du cuir chevelu.') },
    { cat: mark('Outils coiffants'), name: 'ghd', url: 'https://www.ghdhair.com/fr/', logo: 'images/marques/ghd.svg', h: 60, post: 'ghd-outils-coiffants',
      text: mark('Lisseur ghd Chronos, sèche-cheveux ghd Helios et boucleur ghd Chronos Conical Wand.') },
  ];

  /** Articles du blog consacrés aux marques partenaires (chargés depuis l'API, dans l'ordre des marques). */
  private readonly posts = signal<BlogPost[]>([]);
  protected readonly brandPosts = computed(() => {
    const lang = this.i18n.siteLang();
    return this.partners
      .map((b) => this.posts().find((p) => p.slug === b.post))
      .filter((p): p is BlogPost => !!p)
      .map((p) => {
        const l = localizePost(p, lang);
        return { ...l, link: localizePath('/blog/' + p.slug, lang === 'en' && l.has_en ? 'en' : 'fr') };
      });
  });

  protected readonly steps = [
    { title: mark('[étape] Accueil'), text: mark('Un temps pour faire connaissance, dans le calme et la douceur.') },
    { title: mark('Diagnostic'), text: mark('Nous écoutons vos besoins et analysons votre peau.') },
    { title: mark('Soin'), text: mark('Un soin sur-mesure, réalisé avec expertise et attention.') },
    { title: mark('Conseils'), text: mark('Des recommandations pour prolonger les bienfaits chez vous.') },
  ];

  constructor() {
    const seo = inject(SeoService);
    const s = this.content.settings();
    const cats = this.content.categories();
    seo.set({
      ...seo.page('/soins'),
      path: '/soins',
      breadcrumb: this.i18n.tr('Soins'),
      jsonLd: [
        seo.business(s, {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: this.i18n.tr('Carte des soins OPAAL'),
            itemListElement: cats.map((c) => ({
              '@type': 'OfferCatalog',
              name: c.title,
              itemListElement: c.services.map((sv) => ({
                '@type': 'Offer',
                itemOffered: { '@type': 'Service', name: sv.name, description: sv.description, url: `${seo.url('/soins')}#${c.slug}` },
                ...(sv.price !== null ? { price: sv.price, priceCurrency: 'MAD' } : {}),
              })),
            })),
          },
        }),
      ],
    });

    const api = inject(PublicApi);
    afterNextRender(() => {
      api.blog().then((list) => this.posts.set(list), () => undefined);
    });

    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const stop = this.fx.addTicker(() => {
        const vh = this.doc.defaultView!.innerHeight;
        let cur = 0;
        this.blocks().forEach((b, i) => {
          const el = this.doc.getElementById(b.slug);
          if (el && el.getBoundingClientRect().top < vh * 0.45) {
            cur = i;
          }
        });
        if (cur !== this.active()) {
          this.active.set(cur);
          const chip = this.doc.querySelectorAll<HTMLElement>('.chips .chip')[cur];
          const bar = chip?.parentElement;
          if (chip && bar) {
            bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' });
          }
        }
      });
      destroyRef.onDestroy(stop);
    });
  }

  protected go(slug: string, event: Event): void {
    event.preventDefault();
    this.doc.getElementById(slug)?.scrollIntoView({ behavior: this.fx.reducedMotion ? 'auto' : 'smooth' });
    history.replaceState(null, '', this.i18n.path('/soins') + '#' + slug);
  }
}
