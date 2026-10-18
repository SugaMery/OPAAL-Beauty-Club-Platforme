import { DOCUMENT, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE_NAME, SITE_URL } from './site';
import { PageSeo, Settings } from './models';
import { fullAddress, telHref } from './format';
import { ContentService } from './content.service';
import { pageSeoDefaults } from './page-seo';
import { I18nService, LANGS, Lang, localizePath } from './i18n';

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_WORDS = ['lundi|monday', 'mardi|tuesday', 'mercredi|wednesday', 'jeudi|thursday', 'vendredi|friday', 'samedi|saturday', 'dimanche|sunday'];

/**
 * Horaires au format Google (schema.org) à partir des lignes saisies en texte libre,
 * ex. « Du mardi au dimanche » + « 10h – 20h ». Les lignes illisibles ou « Fermé » sont ignorées.
 */
export function openingHours(s: Settings): object[] {
  const time = (hh: string, mm: string | undefined, ap: string | undefined) => {
    let n = Number(hh) % 24;
    if (ap?.toLowerCase() === 'pm' && n < 12) n += 12;
    return String(n).padStart(2, '0') + ':' + (mm ?? '00');
  };
  const out: object[] = [];
  for (const h of s.hours ?? []) {
    const days = h.days.toLowerCase();
    const found = DAY_WORDS.map((w, i) => ({ i, at: days.search(new RegExp(w)) })).filter((d) => d.at >= 0).sort((a, b) => a.at - b.at);
    const t = h.time.match(/(\d{1,2})\s*(?:h|:)?\s*(\d{2})?\s*(am|pm)?\s*[–—-]\s*(\d{1,2})\s*(?:h|:)?\s*(\d{2})?\s*(am|pm)?/i);
    if (!found.length || !t) continue;
    // « du mardi au dimanche », « Tuesday to Sunday », « lundi – vendredi » : plage de jours ; sinon jours cités
    const isRange = found.length === 2 && /\b(au|à|to)\b|[–—-]/.test(days);
    const list = isRange
      ? Array.from({ length: ((found[1].i - found[0].i + 7) % 7) + 1 }, (_, k) => (found[0].i + k) % 7)
      : found.map((d) => d.i);
    out.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: list.map((i) => WEEK[i]),
      opens: time(t[1], t[2], t[3]),
      closes: time(t[4], t[5], t[6]),
    });
  }
  return out;
}

export interface SeoData {
  title: string;
  description: string;
  /** Adresse française de la page (« /soins ») : l'adresse anglaise en est déduite (« /en/soins »). */
  path: string;
  /** Image de partage (chemin du site, ex. « images/og/soins.jpg »). */
  image?: string;
  imageAlt?: string;
  noindex?: boolean;
  jsonLd?: object[];
  breadcrumb?: string;
  /** Page parente dans le fil d'Ariane (ex. Blog pour un article). */
  parent?: { name: string; path: string };
  type?: 'website' | 'article';
  published?: string;
  /** Langues dans lesquelles la page existe (par défaut : toutes les langues publiées). */
  langs?: Lang[];
}

const OG_LOCALES: Record<Lang, string> = { fr: 'fr_MA', en: 'en_GB' };

/** Balises SEO de chaque page : titre, description, canonique, langues, Open Graph, Twitter et données structurées. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly content = inject(ContentService);
  private readonly i18n = inject(I18nService);
  private last: SeoData | null = null;
  /** Page affichée et langues dans lesquelles elle existe (pour le sélecteur de langue). */
  readonly current = signal<{ path: string; langs: Lang[]; parent: string } | null>(null);

  constructor() {
    // Titres personnalisés dans l'espace propriétaire : réappliqués dès que le contenu à jour est chargé.
    effect(() => {
      this.content.rawSettings();
      untracked(() => this.last && this.apply(this.last));
    });
  }

  private get lang(): Lang {
    return this.i18n.siteLang();
  }

  /** Titre, description et image de partage par défaut d'une page (voir page-seo.ts), dans la langue du site. */
  page(path: string): Pick<SeoData, 'title' | 'description' | 'image' | 'imageAlt'> {
    const d = pageSeoDefaults(this.lang)[path];
    return { title: d?.title ?? SITE_NAME, description: d?.description ?? '', image: d?.image, imageAlt: d?.imageAlt };
  }

  set(data: SeoData): void {
    this.last = data;
    this.current.set({ path: data.path, langs: data.langs ?? [...LANGS], parent: data.parent?.path ?? '/' });
    this.apply(data);
  }

  /** Adresse de la page affichée dans une autre langue (sinon sa page parente, ou l'accueil). */
  switchUrl(lang: Lang): string {
    const c = this.current();
    if (!c) return localizePath('/', lang);
    return localizePath(c.langs.includes(lang) ? c.path : c.parent, lang);
  }

  /** Adresse complète d'une page dans une langue. */
  url(path: string, lang: Lang = this.lang): string {
    const p = localizePath(path, lang);
    return SITE_URL + (p === '/' ? '/' : p);
  }

  private apply(input: SeoData): void {
    const lang = this.lang;
    const raw = this.content.rawSettings();
    const seo = lang === 'en' ? raw.seo_en : raw.seo;
    const o: Partial<PageSeo> = (seo && !Array.isArray(seo) ? seo[input.path] : undefined) ?? {};
    const data = { ...input, title: o.title || input.title, description: o.description || input.description, image: o.image || input.image };
    const url = this.url(data.path);
    const imagePath = (data.image || 'images/og-opaal.jpg').replace(/^\//, '');
    const image = /^https?:\/\//.test(imagePath) ? imagePath : SITE_URL + '/' + imagePath;
    const alt = data.imageAlt || data.title;
    this.title.setTitle(data.title);
    this.tag('name', 'description', data.description);
    this.tag('name', 'robots', data.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    this.tag('property', 'og:type', data.type ?? 'website');
    this.tag('property', 'og:site_name', SITE_NAME);
    this.tag('property', 'og:locale', OG_LOCALES[lang]);
    this.tag('property', 'og:title', data.title);
    this.tag('property', 'og:description', data.description);
    this.tag('property', 'og:url', url);
    this.tag('property', 'og:image', image);
    this.tag('property', 'og:image:alt', alt);
    // Dimensions connues pour les images de partage du site (1200 × 630)
    if (/^images\/(og\/|og-opaal)/.test(imagePath)) {
      this.tag('property', 'og:image:width', '1200');
      this.tag('property', 'og:image:height', '630');
    } else {
      this.meta.removeTag('property="og:image:width"');
      this.meta.removeTag('property="og:image:height"');
    }
    if (data.type === 'article' && data.published) {
      this.tag('property', 'article:published_time', data.published);
    } else {
      this.meta.removeTag('property="article:published_time"');
    }
    this.tag('name', 'twitter:card', 'summary_large_image');
    this.tag('name', 'twitter:title', data.title);
    this.tag('name', 'twitter:description', data.description);
    this.tag('name', 'twitter:image', image);
    this.tag('name', 'twitter:image:alt', alt);
    this.canonical(data.noindex ? null : url);
    this.alternates(data.path, data.noindex ? [] : this.pageLangs(data));

    const blocks = [...(data.jsonLd ?? [])];
    if (data.breadcrumb) {
      blocks.push(this.breadcrumb(data.breadcrumb, url, data.parent));
    }
    this.jsonLd(blocks);
  }

  /** Langues publiées dans lesquelles la page existe. */
  private pageLangs(data: SeoData): Lang[] {
    const published = this.content.languages();
    return (data.langs ?? LANGS).filter((l) => published.includes(l));
  }

  /** Page web (type schema.org : AboutPage, ContactPage, CollectionPage…) rattachée à l'institut. */
  webPage(type: string, path: string, name: string, description: string, extra: Record<string, unknown> = {}): object {
    const url = this.url(path);
    return {
      '@context': 'https://schema.org',
      '@type': type,
      '@id': url + '#page',
      url,
      name,
      description,
      inLanguage: this.lang,
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: this.url('/') },
      about: { '@id': SITE_URL + '/#salon' },
      ...extra,
    };
  }

  /** Données structurées « spa, coiffeur et institut de beauté » (Google : fiche locale, horaires, contact). */
  business(s: Settings, extra: Record<string, unknown> = {}): object {
    const sameAs = [s.instagram, s.facebook, s.tiktok, s.pinterest].filter((u) => !!u && u !== '#');
    const hours = openingHours(s);
    return {
      '@context': 'https://schema.org',
      '@type': ['BeautySalon', 'DaySpa', 'HairSalon'],
      '@id': SITE_URL + '/#salon',
      name: SITE_NAME,
      description: this.i18n.tr('Spa, coiffeur et institut de beauté à Marrakech : massages, soins du visage et du corps, coiffure.'),
      url: this.url('/'),
      logo: SITE_URL + '/images/logo-opaal.png',
      image: [SITE_URL + '/images/og-opaal.jpg', SITE_URL + '/images/soin-visage-guasha.jpg'],
      telephone: telHref(s.phone).replace('tel:', ''),
      email: s.email,
      priceRange: '$$',
      currenciesAccepted: 'MAD',
      address: {
        '@type': 'PostalAddress',
        streetAddress: [s.address_line1, s.address_line2].filter(Boolean).join(', '),
        addressLocality: s.city,
        addressCountry: 'MA',
      },
      hasMap: s.maps_url,
      areaServed: { '@type': 'City', name: 'Marrakech' },
      availableLanguage: this.content.languages().map((l) => (l === 'en' ? 'English' : 'French')),
      ...(sameAs.length ? { sameAs } : {}),
      ...(hours.length ? { openingHoursSpecification: hours } : {}),
      ...extra,
    };
  }

  address(s: Settings): string {
    return fullAddress(s);
  }

  private breadcrumb(name: string, url: string, parent?: { name: string; path: string }): object {
    const items = [{ name: this.i18n.tr('Accueil'), item: this.url('/') }];
    if (parent) items.push({ name: parent.name, item: this.url(parent.path) });
    items.push({ name, item: url });
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, ...it })),
    };
  }

  private tag(attr: 'name' | 'property', key: string, content: string): void {
    this.meta.updateTag({ [attr]: key, content }, `${attr}="${key}"`);
  }

  private canonical(url: string | null): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!url) {
      link?.remove();
      return;
    }
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  /** Liens vers les versions de la page dans les autres langues (hreflang), si elle existe en plusieurs langues. */
  private alternates(path: string, langs: Lang[]): void {
    this.doc.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((l) => l.remove());
    if (langs.length < 2) return;
    for (const l of [...langs, 'x-default' as const]) {
      const link = this.doc.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', l);
      link.setAttribute('href', this.url(path, l === 'x-default' ? 'fr' : l));
      this.doc.head.appendChild(link);
    }
  }

  private jsonLd(blocks: object[]): void {
    this.doc.head.querySelectorAll('script[data-seo="ld"]').forEach((s) => s.remove());
    for (const block of blocks) {
      const script = this.doc.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute('data-seo', 'ld');
      script.textContent = JSON.stringify(block).replace(/</g, '\\u003c');
      this.doc.head.appendChild(script);
    }
  }
}
