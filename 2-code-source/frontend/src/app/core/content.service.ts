import { HttpClient } from '@angular/common/http';
import { DOCUMENT, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { API_BASE } from './site';
import { DEFAULT_CONTENT } from './default-content';
import { SiteContent, SlotOverride } from './models';
import { formatPrice } from './format';
import { CollectionItem, GALLERY_DEFAULT, INSTAGRAM_DEFAULT, SLOT_MAP, SlotImage } from './media-slots';
import { I18nService, Lang } from './i18n';
import { localizeCategory, localizeOffer, localizeSettings } from './localize';

type ImageOverrides = Record<string, SlotOverride>;

/**
 * Contenu du site (coordonnées, soins et tarifs, offres, avis, images), dans la langue affichée.
 * Démarre avec le contenu par défaut, puis se met à jour depuis l'API dans le navigateur.
 * Les images modifiées sont connues dès le démarrage (données écrites dans la page par le serveur),
 * pour ne jamais afficher l'ancienne image.
 */
@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly doc = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);
  private readonly content = signal<SiteContent>(DEFAULT_CONTENT);
  private readonly imageOverrides = signal<ImageOverrides>(this.bootImages());
  private loading = false;

  readonly loaded = signal(false);
  readonly lang = this.i18n.lang;
  /** Réglages tels qu'enregistrés (textes français et anglais). */
  readonly rawSettings = computed(() => this.content().settings);
  /** Catégories non traduites (noms français et anglais), pour le bon cadeau bilingue. */
  readonly rawCategories = computed(() => this.content().categories);
  readonly settings = computed(() => localizeSettings(this.content().settings, this.lang()));
  readonly categories = computed(() => this.content().categories.map((c) => localizeCategory(c, this.lang())));
  readonly offers = computed(() => this.content().offers.map((o) => localizeOffer(o, this.lang())));
  readonly formules = computed(() => this.offers().filter((o) => o.type === 'formule'));
  readonly promos = computed(() => this.offers().filter((o) => o.type === 'promo'));
  readonly reviews = computed(() => this.content().reviews);
  readonly averageRating = computed(() => {
    const r = this.reviews();
    return r.length ? Math.round((r.reduce((s, x) => s + x.rating, 0) / r.length) * 10) / 10 : 0;
  });
  /** Langues publiées (le français est toujours actif). */
  readonly languages = computed<Lang[]>(() => {
    const l = this.content().settings.languages;
    return Array.isArray(l) && !l.includes('en') ? ['fr'] : ['fr', 'en'];
  });
  readonly englishEnabled = computed(() => this.languages().includes('en'));
  readonly gallery = computed<CollectionItem[]>(() => this.collection(this.content().settings.gallery ?? GALLERY_DEFAULT));
  readonly instagram = computed<CollectionItem[]>(() => this.collection(this.content().settings.feed ?? INSTAGRAM_DEFAULT));

  /** Image d'un emplacement du site (modifiée dans l'espace propriétaire, sinon celle d'origine). */
  img(key: string, fallback?: Partial<SlotImage>): SlotImage {
    const def = SLOT_MAP[key];
    const o = this.imageOverrides()[key] ?? {};
    const en = this.lang() === 'en';
    const defAlt = def?.alt || fallback?.alt || '';
    // Anglais : texte saisi en anglais, sinon texte français de la nouvelle photo, sinon texte d'origine traduit
    const alt = en ? o.alt_en || (o.src ? o.alt : '') || this.i18n.tr(defAlt) : o.alt || defAlt;
    return {
      src: o.src || def?.src || fallback?.src || 'images/soin-visage-fresh.jpg',
      alt: alt || o.alt || defAlt,
      pos: o.pos || def?.pos || fallback?.pos || 'center',
    };
  }

  load(force = false): void {
    if (!this.isBrowser || this.loading || (this.loaded() && !force)) {
      return;
    }
    this.loading = true;
    this.http.get<SiteContent>(`${API_BASE}/content`).subscribe({
      next: (data) => {
        if (data && Array.isArray(data.categories)) {
          this.content.set({ ...DEFAULT_CONTENT, ...data, settings: { ...DEFAULT_CONTENT.settings, ...data.settings } });
          const imgs = data.settings?.images;
          this.imageOverrides.set(imgs && !Array.isArray(imgs) ? imgs : {});
        }
        this.loaded.set(true);
        this.loading = false;
      },
      error: () => {
        this.loading = false; // le contenu par défaut reste affiché
      },
    });
  }

  price(service: { price: number | null; price_from: boolean }): string {
    return formatPrice(service, this.settings().currency || 'DH', this.lang());
  }

  /** Légendes dans la langue affichée (légende anglaise, sinon légende d'origine traduite, sinon française). */
  private collection(items: CollectionItem[]): CollectionItem[] {
    if (this.lang() === 'fr') return items;
    return items.map((i) => ({ ...i, caption: i.caption_en || this.i18n.tr(i.caption) }));
  }

  /** Données écrites dans la page par le serveur (<script id="opaal-boot">). */
  private bootImages(): ImageOverrides {
    if (!this.isBrowser) return {};
    try {
      const raw = this.doc.getElementById('opaal-boot')?.textContent;
      const data = raw ? JSON.parse(raw) : null;
      return data?.images && !Array.isArray(data.images) ? data.images : {};
    } catch {
      return {};
    }
  }
}
