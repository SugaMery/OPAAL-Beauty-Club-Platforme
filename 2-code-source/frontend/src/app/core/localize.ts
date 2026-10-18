import type { Lang } from './i18n';
import { BlogPost, Category, LegalSection, Offer, Settings } from './models';

/**
 * Contenu modifiable (soins, offres, coordonnées, articles) dans la langue affichée.
 * Règle unique : un champ anglais vide affiche le texte français.
 */
export function pick(fr: string, en: string | undefined | null, lang: Lang): string {
  return lang === 'en' && en && en.trim() ? en : fr;
}

export function localizeCategory(c: Category, lang: Lang): Category {
  if (lang === 'fr') return c;
  return {
    ...c,
    title: pick(c.title, c.title_en, lang),
    intro: pick(c.intro, c.intro_en, lang),
    services: c.services.map((s) => ({
      ...s, name: pick(s.name, s.name_en, lang), description: pick(s.description, s.description_en, lang), grp: pick(s.grp ?? '', s.grp_en, lang),
    })),
  };
}

export function localizeOffer(o: Offer, lang: Lang): Offer {
  if (lang === 'fr') return o;
  return {
    ...o,
    title: pick(o.title, o.title_en, lang),
    subtitle: pick(o.subtitle, o.subtitle_en, lang),
    description: pick(o.description, o.description_en, lang),
    perks: o.perks_en?.some((p) => p.trim()) ? o.perks_en.filter((p) => p.trim()) : o.perks,
    price: pick(o.price, o.price_en, lang),
    badge: pick(o.badge, o.badge_en, lang),
  };
}

export function localizeSettings(s: Settings, lang: Lang): Settings {
  if (lang === 'fr') return s;
  return {
    ...s,
    announcement: pick(s.announcement, s.announcement_en, lang),
    address_line1: pick(s.address_line1, s.address_line1_en, lang),
    address_line2: pick(s.address_line2, s.address_line2_en, lang),
    city: pick(s.city, s.city_en, lang),
    country: pick(s.country, s.country_en, lang),
    access_note: pick(s.access_note ?? '', s.access_note_en, lang),
    hours: (s.hours ?? []).map((h) => ({ ...h, days: pick(h.days, h.days_en, lang), time: pick(h.time, h.time_en, lang) })),
  };
}

/** Article dans la langue demandée ; « has_en » indique s'il est réellement traduit. */
export function localizePost(p: BlogPost, lang: Lang): BlogPost {
  if (lang === 'fr' || !p.has_en) return p;
  return {
    ...p,
    title: pick(p.title, p.title_en, lang),
    excerpt: pick(p.excerpt, p.excerpt_en, lang),
    category: pick(p.category, p.category_en, lang),
    cover_alt: pick(p.cover_alt, p.cover_alt_en, lang),
    seo_title: pick(p.seo_title, p.seo_title_en, lang),
    seo_description: pick(p.seo_description, p.seo_description_en, lang),
    content: pick(p.content ?? '', p.content_en, lang),
    reading_time: p.reading_time_en || p.reading_time,
  };
}

/** Mentions légales : version anglaise si elle existe, sinon texte français personnalisé, sinon texte par défaut. */
export function pickLegal(s: Settings, lang: Lang, defaults: Record<Lang, LegalSection[]>): LegalSection[] {
  if (lang === 'en' && s.legal_en?.length) return s.legal_en;
  if (s.legal?.length) return s.legal;
  return defaults[lang];
}
