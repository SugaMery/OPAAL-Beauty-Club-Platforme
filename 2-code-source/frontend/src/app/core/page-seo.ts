import { DEFAULT_CONTENT } from './default-content';
import { fullAddress } from './format';
import type { Lang } from './i18n';
import { localizeSettings } from './localize';

export interface PageSeoDefault {
  label: string;
  /** Titre Google : 50 à 60 caractères. */
  title: string;
  /** Description Google : 120 à 160 caractères. */
  description: string;
  /** Image de partage 1200 × 630 (Facebook, WhatsApp, Instagram…). */
  image: string;
  imageAlt: string;
}

const s = DEFAULT_CONTENT.settings;
const sEn = localizeSettings(s, 'en');

/**
 * Titre, description et image de partage par défaut de chaque page.
 * Modifiables page par page dans l'espace propriétaire (Pages & SEO).
 */
export const PAGE_SEO: Record<string, PageSeoDefault> = {
  '/': {
    label: 'Accueil',
    title: 'Spa, coiffeur et institut de beauté à Marrakech | OPAAL',
    description:
      'Spa, massages, coiffeur et soins du visage à Amelkis, Marrakech. Ouvert du mardi au dimanche, de 10h à 20h. Réservez en ligne chez OPAAL Beauty Club.',
    image: 'images/og-opaal.jpg',
    imageAlt: 'OPAAL Beauty Club, spa et institut de beauté à Marrakech',
  },
  '/soins': {
    label: 'Soins & tarifs',
    title: 'Soins & tarifs : spa, massages, coiffure | OPAAL Marrakech',
    description:
      'Carte et tarifs OPAAL à Marrakech : soins du visage VIE Collection, massages, coiffure, coloration, lissage, manucure, pédicure et épilation. Réservation en ligne.',
    image: 'images/og/soins.jpg',
    imageAlt: 'Massage des épaules chez OPAAL Beauty Club',
  },
  '/carte-cadeau': {
    label: 'Carte cadeau',
    title: 'Carte cadeau spa & beauté à Marrakech | OPAAL Beauty Club',
    description:
      'Offrez une carte cadeau OPAAL Beauty Club : soin du visage, massage, coiffure ou rituel mains & pieds au Club House d’Amelkis 3, à Marrakech.',
    image: 'images/og/membership.jpg',
    imageAlt: 'Carte cadeau OPAAL Beauty Club',
  },
  '/membership': {
    label: 'Membership',
    title: 'Club OPAAL : membership & avantages beauté à Marrakech',
    description:
      'Rejoignez le club OPAAL à Marrakech : avantages exclusifs, soins privilégiés, réservation prioritaire et suivi personnalisé. Découvrez nos formules.',
    image: 'images/og/membership.jpg',
    imageAlt: 'Le club OPAAL Beauty Club',
  },
  '/a-propos': {
    label: 'À propos',
    title: 'À propos d’OPAAL Beauty Club, spa et institut à Amelkis',
    description:
      'OPAAL Beauty Club, spa, coiffeur et institut de beauté à Amelkis, Marrakech : une beauté authentique et durable, des soins experts, un cadre apaisant.',
    image: 'images/og/a-propos.jpg',
    imageAlt: 'Mains expertes lors d’un massage chez OPAAL',
  },
  '/galerie': {
    label: 'Galerie',
    title: 'Galerie photos : spa, massages, coiffure | OPAAL Marrakech',
    description:
      'Massages, soins du visage et coiffure : découvrez en images l’univers d’OPAAL Beauty Club, spa et institut de beauté à Marrakech.',
    image: 'images/og/galerie.jpg',
    imageAlt: 'Balayage lumineux réalisé chez OPAAL',
  },
  '/contact': {
    label: 'Contact',
    title: 'Contact & rendez-vous : spa et coiffeur à Amelkis | OPAAL',
    description: `OPAAL Beauty Club, ${fullAddress(s)}. Tél. ${s.phone}. Du mardi au dimanche, 10h – 20h. Réservez en ligne, sur WhatsApp ou par téléphone.`,
    image: 'images/og/contact.jpg',
    imageAlt: 'Soin du visage chez OPAAL Beauty Club',
  },
  '/avis': {
    label: 'Avis clientes',
    title: 'Avis clientes OPAAL Beauty Club | Spa à Marrakech',
    description:
      'Découvrez les avis de nos clientes sur nos massages, soins du visage et du corps et notre coiffure à Marrakech, et partagez à votre tour votre expérience.',
    image: 'images/og/avis.jpg',
    imageAlt: 'Cliente au teint lumineux après un soin OPAAL',
  },
  '/blog': {
    label: 'Blog',
    title: 'Blog beauté : conseils soins & bien-être | OPAAL Marrakech',
    description:
      'Conseils d’esthéticiennes, soins du visage, massages et bien-être : le blog d’OPAAL Beauty Club, spa et institut de beauté à Marrakech.',
    image: 'images/og/blog.jpg',
    imageAlt: 'Le blog beauté d’OPAAL Beauty Club',
  },
  '/mentions-legales': {
    label: 'Mentions légales & conditions',
    title: 'Mentions légales & conditions | OPAAL Beauty Club',
    description: 'Mentions légales, conditions de rendez-vous, politique de confidentialité et cookies du site OPAAL Beauty Club, institut de beauté à Marrakech.',
    image: 'images/og-opaal.jpg',
    imageAlt: 'OPAAL Beauty Club',
  },
};

/** Version anglaise (pages /en/…), modifiable dans l'espace propriétaire (Pages & SEO, onglet English). */
export const PAGE_SEO_EN: Record<string, PageSeoDefault> = {
  '/': {
    label: 'Home',
    title: 'Spa, hair & beauty salon in Marrakech | OPAAL Beauty Club',
    description:
      'Spa, massages, hairdresser and facials in Amelkis, Marrakech. Open Tuesday to Sunday, 10am to 8pm. Book your moment online at OPAAL Beauty Club.',
    image: 'images/og-opaal.jpg',
    imageAlt: 'OPAAL Beauty Club, spa and beauty salon in Marrakech',
  },
  '/soins': {
    label: 'Treatments & prices',
    title: 'Treatments & prices: spa, massage, hair | OPAAL Marrakech',
    description:
      'OPAAL menu and prices in Marrakech: VIE Collection facials, massages, hair, colour, smoothing, manicure, pedicure and waxing. Online booking.',
    image: 'images/og/soins.jpg',
    imageAlt: 'Shoulder massage at OPAAL Beauty Club',
  },
  '/carte-cadeau': {
    label: 'Gift card',
    title: 'Spa & beauty gift card in Marrakech | OPAAL Beauty Club',
    description:
      'Give an OPAAL Beauty Club gift card: a facial, massage, hair appointment or hands & feet ritual at the Amelkis 3 Club House in Marrakech.',
    image: 'images/og/membership.jpg',
    imageAlt: 'OPAAL Beauty Club gift card',
  },
  '/membership': {
    label: 'Membership',
    title: 'OPAAL Club: beauty membership & perks in Marrakech',
    description:
      'Join the OPAAL club in Marrakech: exclusive perks, privileged treatments, priority booking and personalised care. Discover our membership plans.',
    image: 'images/og/membership.jpg',
    imageAlt: 'The OPAAL Beauty Club membership',
  },
  '/a-propos': {
    label: 'About',
    title: 'About OPAAL Beauty Club, spa & beauty salon in Amelkis',
    description:
      'OPAAL Beauty Club, spa, hair and beauty salon in Amelkis, Marrakech: authentic, lasting beauty, expert treatments and a refined, soothing setting.',
    image: 'images/og/a-propos.jpg',
    imageAlt: 'Expert hands during a massage at OPAAL',
  },
  '/galerie': {
    label: 'Gallery',
    title: 'Photo gallery: spa, massage, hair | OPAAL Marrakech',
    description:
      'Massages, facials and hair: discover the world of OPAAL Beauty Club, spa and beauty salon in Marrakech, in pictures.',
    image: 'images/og/galerie.jpg',
    imageAlt: 'Luminous balayage by OPAAL',
  },
  '/contact': {
    label: 'Contact',
    title: 'Contact & booking: spa & hair salon in Amelkis | OPAAL',
    description: `OPAAL Beauty Club, ${fullAddress(sEn)}. Phone ${s.phone}. Tuesday to Sunday, 10am – 8pm. Book online, on WhatsApp or by phone.`,
    image: 'images/og/contact.jpg',
    imageAlt: 'Facial at OPAAL Beauty Club',
  },
  '/avis': {
    label: 'Client reviews',
    title: 'OPAAL Beauty Club reviews | Spa in Marrakech',
    description:
      'Read what our clients say about our massages, facials, body treatments and hair services in Marrakech, and share your own experience.',
    image: 'images/og/avis.jpg',
    imageAlt: 'Client with a glowing complexion after an OPAAL treatment',
  },
  '/blog': {
    label: 'Blog',
    title: 'Beauty blog: skincare & wellbeing tips | OPAAL Marrakech',
    description:
      'Beauty therapists’ advice, facials, massages and wellbeing: the blog of OPAAL Beauty Club, spa and beauty salon in Marrakech.',
    image: 'images/og/blog.jpg',
    imageAlt: 'The OPAAL Beauty Club beauty blog',
  },
  '/mentions-legales': {
    label: 'Legal notice & terms',
    title: 'Legal notice & terms | OPAAL Beauty Club',
    description: 'Legal notice, booking terms, privacy policy and cookies of the OPAAL Beauty Club website, beauty salon in Marrakech.',
    image: 'images/og-opaal.jpg',
    imageAlt: 'OPAAL Beauty Club',
  },
};

export function pageSeoDefaults(lang: Lang): Record<string, PageSeoDefault> {
  return lang === 'en' ? PAGE_SEO_EN : PAGE_SEO;
}
