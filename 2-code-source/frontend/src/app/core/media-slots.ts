import { CARD_IMAGES, CATEGORY_IMAGES, POSTS } from './site';
import { mark } from './i18n';

/** Image affichée à un emplacement du site. */
export interface SlotImage {
  src: string;
  alt: string;
  /** Point de cadrage (object-position), ex. « 50% 40% ». */
  pos: string;
}

export interface SlotDef extends SlotImage {
  key: string;
  group: string;
  /** Nom de l'emplacement ; « {cat} » est remplacé par le nom de la catégorie (champ cat). */
  label: string;
  cat?: string;
  /** Conseil de format pour la propriétaire. */
  hint: string;
}

export interface CollectionItem {
  src: string;
  caption: string;
  caption_en?: string;
  cat: string;
  w?: number;
  h?: number;
}

const CAT_LABELS: Record<string, string> = {
  visage: mark('Soins visage'),
  corps: mark('Massages'),
  cheveux: mark('Coiffure'),
  'mains-pieds': mark('Mains & pieds'),
  epilation: mark('Épilation & sourcils'),
};

/**
 * Emplacements d'images modifiables depuis l'espace propriétaire (Images du site).
 * Dans les pages, chaque image porte l'attribut data-slot="clé" : le serveur remplace
 * aussi l'image dans les pages HTML pré-rendues (Google, partages).
 */
export const SLOTS: SlotDef[] = [
  { key: 'home.hero', group: mark('Accueil'), label: mark('Grande photo d’accueil'), hint: mark('Photo horizontale ou carrée, 1600 px de large minimum.'), src: 'images/soin-visage-eclat.jpg', alt: mark('Peau lumineuse après un soin du visage chez OPAAL Beauty Club'), pos: '62% 32%' },
  { key: 'home.about', group: mark('Accueil'), label: mark('Photo « À propos de nous »'), hint: mark('Photo verticale de préférence.'), src: 'images/soins-corps.jpg', alt: mark('Massage des épaules et du dos'), pos: '50% 88%' },
  ...Object.entries(CARD_IMAGES).map(([slug, v]) => ({
    key: 'card.' + slug, group: mark('Accueil'), label: mark('Carte « {cat} »'), cat: CAT_LABELS[slug], hint: mark('Photo verticale (format portrait).'),
    src: v.src, alt: CAT_LABELS[slug], pos: v.pos,
  })),
  { key: 'soins.hero', group: mark('Page Soins'), label: mark('Photo d’en-tête'), hint: mark('Photo verticale (en arche).'), src: 'images/soins-corps.jpg', alt: mark('Massage des épaules'), pos: '50% 28%' },
  ...Object.entries(CATEGORY_IMAGES).map(([slug, v]) => ({
    key: 'cat.' + slug, group: mark('Page Soins'), label: mark('Photo « {cat} »'), cat: CAT_LABELS[slug], hint: mark('Photo verticale de préférence.'),
    src: v.src, alt: v.alt, pos: v.pos,
  })),
  { key: 'about.lieu', group: mark('Autres pages'), label: mark('À propos — photo « Le lieu »'), hint: mark('Photo verticale (format portrait).'), src: 'images/amelkis-golf.jpg', alt: mark('Vue sur le golf d’Amelkis 3 depuis le Club House'), pos: '50% 60%' },
  { key: 'about.hero', group: mark('Autres pages'), label: mark('À propos — photo d’en-tête'), hint: mark('Photo verticale (en arche).'), src: 'images/massage-mains.jpg', alt: mark('Mains expertes lors d’un massage'), pos: '55% 55%' },
  { key: 'gallery.hero', group: mark('Autres pages'), label: mark('Galerie — photo d’en-tête'), hint: mark('Photo verticale (en arche).'), src: 'images/coiffure-balayage.jpg', alt: mark('Cheveux ondulés au balayage'), pos: '50% 55%' },
  { key: 'contact.hero', group: mark('Autres pages'), label: mark('Contact — photo d’en-tête'), hint: mark('Photo verticale (en arche).'), src: 'images/soin-visage-fresh.jpg', alt: mark('Soin du visage'), pos: '62% 42%' },
  { key: 'blog.hero', group: mark('Autres pages'), label: mark('Blog — photo d’en-tête'), hint: mark('Photo verticale (en arche).'), src: 'images/post-guasha.jpg', alt: mark("L'art du soin"), pos: '50% 40%' },
];

export const SLOT_MAP: Record<string, SlotDef> = Object.fromEntries(SLOTS.map((s) => [s.key, s]));

/** Photos d'origine de la galerie. */
export const GALLERY_DEFAULT: CollectionItem[] = [
  { src: 'images/soin-visage-guasha.jpg', caption: mark('Soin du visage au gua sha'), cat: 'visage', w: 1920, h: 1692 },
  { src: 'images/coiffure-balayage.jpg', caption: mark('Balayage lumineux'), cat: 'cheveux', w: 1080, h: 1140 },
  { src: 'images/mains-pieds.jpg', caption: mark('Soin signature mains & pieds'), cat: 'mains-pieds', w: 1536, h: 1024 },
  { src: 'images/soin-visage-fresh.jpg', caption: mark('Fresh skin'), cat: 'visage', w: 1080, h: 1350 },
  { src: 'images/soins-corps.jpg', caption: mark('Massage des épaules'), cat: 'corps', w: 1920, h: 1244 },
  { src: 'images/epilation.jpg', caption: mark('Épilation à la cire à l’huile d’argan'), cat: 'epilation', w: 1024, h: 683 },
  { src: 'images/coiffure-shampoing.jpg', caption: mark('Shampoing & massage crânien'), cat: 'cheveux', w: 1080, h: 1140 },
  { src: 'images/soin-visage-eclat.jpg', caption: mark('Une peau lumineuse'), cat: 'visage', w: 1320, h: 1642 },
  { src: 'images/massage-mains.jpg', caption: mark('Massage aux huiles'), cat: 'corps', w: 1920, h: 1223 },
  { src: 'images/amelkis-golf.jpg', caption: mark('Le golf d’Amelkis 3, face au Club House'), cat: 'lieu', w: 1320, h: 1643 },
];

/** Publications « Instagram » d'origine (bandeau défilant de l'accueil). */
export const INSTAGRAM_DEFAULT: CollectionItem[] = POSTS.map((p) => ({ ...p, w: 864, h: 1080 }));

/** Photos déjà présentes sur le site (proposées dans la médiathèque). */
export const SITE_PHOTOS: { src: string; alt: string }[] = [
  { src: 'images/soin-visage-guasha.jpg', alt: mark('Soin du visage au gua sha') },
  { src: 'images/soin-visage-fresh.jpg', alt: mark('Soin du visage') },
  { src: 'images/soins-corps.jpg', alt: mark('Massage des épaules') },
  { src: 'images/massage-mains.jpg', alt: mark('Massage aux huiles') },
  { src: 'images/coiffure-balayage.jpg', alt: mark('Balayage lumineux') },
  { src: 'images/coiffure-shampoing.jpg', alt: mark('Shampoing & massage crânien') },
  ...POSTS.map((p) => ({ src: p.src, alt: p.caption })),
  { src: 'images/og-opaal.jpg', alt: mark('OPAAL Beauty Club — image de partage') },
  { src: 'images/og/soins.jpg', alt: mark('Partage — Soins') },
  { src: 'images/og/membership.jpg', alt: mark('Partage — Membership') },
  { src: 'images/og/a-propos.jpg', alt: mark('Partage — À propos') },
  { src: 'images/og/galerie.jpg', alt: mark('Partage — Galerie') },
  { src: 'images/og/contact.jpg', alt: mark('Partage — Contact') },
  { src: 'images/og/avis.jpg', alt: mark('Partage — Avis') },
  { src: 'images/og/blog.jpg', alt: mark('Partage — Blog') },
];
