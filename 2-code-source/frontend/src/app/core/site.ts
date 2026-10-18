import { mark } from './i18n';

/**
 * Réglages généraux du site.
 * SITE_URL sert aux balises SEO (adresses canoniques, partage sur les réseaux, sitemap).
 */
export const SITE_URL = 'https://opaalbeautyclub.com';
export const SITE_NAME = 'OPAAL Beauty Club';
export const API_BASE = '/api';

/** Photo associée à chaque catégorie de soins (dossier public/images). */
export const CATEGORY_IMAGES: Record<string, { src: string; alt: string; pos: string }> = {
  visage: { src: 'images/soin-visage-guasha.jpg', alt: mark('Massage du visage au gua sha'), pos: '50% 40%' },
  corps: { src: 'images/soins-corps.jpg', alt: mark('Massage des épaules'), pos: '50% 60%' },
  cheveux: { src: 'images/coiffure-shampoing.jpg', alt: mark('Shampoing et massage crânien'), pos: '35% 45%' },
  'mains-pieds': { src: 'images/mains-pieds.jpg', alt: mark('Soin signature mains & pieds'), pos: '45% 50%' },
  epilation: { src: 'images/epilation.jpg', alt: mark('Épilation à la cire à l’huile d’argan'), pos: '45% 50%' },
};

/** Photo des cartes « Nos soins » de l'accueil. */
export const CARD_IMAGES: Record<string, { src: string; pos: string }> = {
  visage: { src: 'images/soin-visage-fresh.jpg', pos: '50% 45%' },
  corps: { src: 'images/soins-corps.jpg', pos: '50% 70%' },
  cheveux: { src: 'images/coiffure-balayage.jpg', pos: '50% 60%' },
  'mains-pieds': { src: 'images/mains-pieds.jpg', pos: '42% 50%' },
  epilation: { src: 'images/epilation.jpg', pos: '50% 50%' },
};

export const CARD_TAGLINES: Record<string, string> = {
  visage: mark('Hydrate, régénère, illumine.'),
  corps: mark('Détente et récupération.'),
  cheveux: mark('Couleur, soin et brushing.'),
  'mains-pieds': mark('Manucure, pédicure, soins signature.'),
  epilation: mark('À la cire à l’huile d’argan.'),
};

/** Publications Instagram affichées sur l'accueil et dans la galerie. */
export const POSTS = [
  { src: 'images/post-guasha.jpg', caption: mark("L'art du soin"), cat: 'visage' },
  { src: 'images/post-massage-mains.jpg', caption: mark('Reconnectez-vous'), cat: 'corps' },
  { src: 'images/post-fresh-skin.jpg', caption: mark('Fresh skin'), cat: 'visage' },
  { src: 'images/post-cheveux.jpg', caption: mark('Hair, beauty & you'), cat: 'cheveux' },
  { src: 'images/post-shampoing.jpg', caption: mark('Crafted to perfection'), cat: 'cheveux' },
  { src: 'images/post-corps-esprit.jpg', caption: mark('Corps & esprit'), cat: 'corps' },
];
