import { mark } from './i18n';

export interface OpeningHours {
  days: string;
  time: string;
  /** Version anglaise (vide = texte français). */
  days_en?: string;
  time_en?: string;
}

export interface Settings {
  salon_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  country: string;
  phone: string;
  whatsapp: string;
  email: string;
  notify_email?: string;
  maps_url: string;
  hours: OpeningHours[];
  instagram: string;
  facebook: string;
  tiktok: string;
  pinterest: string;
  currency: string;
  announcement: string;
  /** Langues publiées sur le site (le français est toujours actif). */
  languages?: string[];
  /** Versions anglaises des textes (vide = texte français). */
  announcement_en?: string;
  address_line1_en?: string;
  address_line2_en?: string;
  city_en?: string;
  country_en?: string;
  /** Indications d'accès (non-résidents d'Amelkis) ; version anglaise. */
  access_note?: string;
  access_note_en?: string;
  /** Au moins un article publié (le lien « Blog » s'affiche alors). Calculé par l'API. */
  has_blog?: boolean;
  /** Agenda de réservation en ligne (Dikidi). */
  booking_url: string;
  /** Lien « Laisser un avis » de la fiche Google Business Profile. */
  google_review_url?: string;
  /** Titres et descriptions personnalisés, par page (« / », « /soins »…). */
  seo?: Record<string, PageSeo> | [];
  /** Idem pour les pages anglaises (/en/…), rangées par adresse française. */
  seo_en?: Record<string, PageSeo> | [];
  /** Mentions légales & conditions (vide = textes par défaut). */
  legal?: LegalSection[];
  legal_en?: LegalSection[];
  /** Images modifiées des emplacements du site (voir media-slots.ts). */
  images?: Record<string, SlotOverride> | [];
  /** Photos de la galerie et des publications de l'accueil (absent = photos d'origine). */
  gallery?: CollectionEntry[];
  feed?: CollectionEntry[];
}

export interface SlotOverride {
  src?: string;
  alt?: string;
  alt_en?: string;
  pos?: string;
}

export interface CollectionEntry {
  src: string;
  caption: string;
  caption_en?: string;
  cat: string;
  w?: number;
  h?: number;
}

export interface PageSeo {
  title: string;
  description: string;
  /** Image de partage (Facebook, WhatsApp…), ex. « images/og/soins.jpg » ou « uploads/… ». */
  image?: string;
}

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  cover: string;
  cover_alt: string;
  status: 'draft' | 'published';
  published_at: string | null;
  updated_at: string;
  reading_time: number;
  seo_title: string;
  seo_description: string;
  content?: string;
  /** Version anglaise (article traduit si titre et texte anglais sont remplis). */
  title_en?: string;
  excerpt_en?: string;
  category_en?: string;
  cover_alt_en?: string;
  seo_title_en?: string;
  seo_description_en?: string;
  content_en?: string;
  has_en?: boolean;
  reading_time_en?: number;
}

export interface LegalSection {
  id: string;
  title: string;
  body: string;
}

export interface Service {
  id: number;
  category_id: number;
  name: string;
  description: string;
  price: number | null;
  price_from: boolean;
  duration: number | null;
  active: boolean;
  sort: number;
  name_en?: string;
  description_en?: string;
  /** Rubrique dans la catégorie (ex. « Coloration »), facultative. */
  grp?: string;
  grp_en?: string;
}

export interface Category {
  id: number;
  slug: string;
  title: string;
  intro: string;
  services: Service[];
  title_en?: string;
  intro_en?: string;
}

export interface Offer {
  id: number;
  type: 'formule' | 'promo';
  title: string;
  subtitle: string;
  description: string;
  perks: string[];
  price: string;
  badge: string;
  featured: boolean;
  active: boolean;
  sort: number;
  title_en?: string;
  subtitle_en?: string;
  description_en?: string;
  perks_en?: string[];
  price_en?: string;
  badge_en?: string;
}

export interface Review {
  id: number;
  name: string;
  rating: number;
  text: string;
  service: string;
  /** Origine : site, google, instagram, facebook, whatsapp, autre. */
  source?: string;
  date: string;
}

export const REVIEW_SOURCES: Record<string, string> = {
  site: mark('Site OPAAL'),
  google: 'Google',
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  autre: mark('Autre'),
};

export interface SiteContent {
  settings: Settings;
  categories: Category[];
  offers: Offer[];
  reviews: Review[];
}

export interface ApiError {
  error: string;
  fields?: Record<string, string>;
}
