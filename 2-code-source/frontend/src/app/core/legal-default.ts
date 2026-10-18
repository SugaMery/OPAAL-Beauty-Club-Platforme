import { LegalSection, Settings } from './models';
import { fullAddress } from './format';

/**
 * Textes par défaut de la page « Mentions légales & conditions ».
 * Modifiables dans l'espace propriétaire (Pages & SEO → Mentions & conditions).
 * Mots-clés remplacés automatiquement : {salon}, {adresse}, {email}, {telephone}.
 * Mise en forme : une ligne vide sépare les paragraphes, « - » en début de ligne crée une liste.
 */
/** Numéro de récépissé de la déclaration CNDP (loi 09-08) ; laissé vide, la phrase s'affiche sans numéro. */
const CNDP_REF = '';

export const DEFAULT_LEGAL: LegalSection[] = [
  {
    id: 'editeur',
    title: 'Éditeur du site',
    body:
      'Le site {salon} est édité par la société PSAAMSPA, société à responsabilité limitée (SARL) au capital de 10 000 MAD, immatriculée au registre du commerce de Marrakech sous le numéro 156523, ICE 003596220000030, dont le siège social est situé 5e étage, Centre d’affaires Sara, 23 avenue Yacoub Mansour, Marrakech, Maroc.\n\n' +
      'Établissement : {salon}, {adresse}.\n\n' +
      'Responsable de la publication : Meryem. Contact : {email} — {telephone}.',
  },
  {
    id: 'hebergement',
    title: 'Hébergement',
    body: 'Le site est hébergé par IONOS SE, Elgendorfer Str. 57, 56410 Montabaur, Allemagne.',
  },
  {
    id: 'conditions',
    title: 'Conditions de rendez-vous',
    body:
      'Les rendez-vous se prennent en ligne sur notre agenda, par téléphone au {telephone} ou sur WhatsApp.\n\n' +
      'En cas d’empêchement, merci de nous prévenir au moins 24 h à l’avance afin que nous puissions proposer votre créneau à une autre cliente.\n\n' +
      'Merci d’arriver quelques minutes avant l’heure de votre rendez-vous. En cas de retard important, la durée du soin pourra être réduite afin de ne pas pénaliser les clientes suivantes.\n\n' +
      'Les tarifs affichés sur le site sont indicatifs et peuvent évoluer : le tarif appliqué est celui en vigueur le jour du soin.',
  },
  {
    id: 'propriete',
    title: 'Propriété intellectuelle',
    body: 'Le logo, le monogramme, les textes, les photographies et l’identité visuelle de {salon} sont protégés. Toute reproduction sans autorisation préalable est interdite.',
  },
  {
    id: 'confidentialite',
    title: 'Politique de confidentialité',
    body:
      'Les informations saisies sur le site (formulaire de contact, avis, inscription à la newsletter) sont utilisées uniquement pour répondre à votre demande, vous envoyer nos actualités si vous vous y êtes inscrite et, pour les avis, les publier après validation (prénom et texte uniquement).\n\n' +
      'La prise de rendez-vous en ligne est assurée par notre agenda Dikidi, qui applique sa propre politique de confidentialité.\n\n' +
      'Vous pouvez vous désinscrire de la newsletter à tout moment grâce au lien présent dans chaque e-mail.\n\n' +
      'Vos données sont conservées de façon sécurisée et ne sont jamais revendues. Conformément à la loi 09-08 relative à la protection des personnes physiques à l’égard du traitement des données à caractère personnel, vous pouvez demander l’accès, la rectification ou la suppression de vos données en nous écrivant à {email}.\n\n' +
      `Les traitements de données personnelles réalisés via ce site ont fait l’objet d’une déclaration auprès de la Commission nationale de contrôle de la protection des données à caractère personnel (CNDP)${CNDP_REF ? `, sous le n° ${CNDP_REF}` : ''}, conformément à la loi n° 09-08.`,
  },
  {
    id: 'cookies',
    title: 'Cookies',
    body:
      'Ce site n’utilise pas de cookies publicitaires ni de traceurs. Les clics sur les boutons « Réserver » sont comptés de façon anonyme, sans cookie, pour nos statistiques. ' +
      'Les polices d’écriture sont chargées depuis Google Fonts et le plan d’accès depuis Google Maps.',
  },
];

/** Version anglaise (page /en/mentions-legales). Mêmes identifiants de section (ancres #conditions…). */
export const DEFAULT_LEGAL_EN: LegalSection[] = [
  {
    id: 'editeur',
    title: 'Website publisher',
    body:
      'The {salon} website is published by PSAAMSPA, a limited liability company (SARL) with a share capital of 10,000 MAD, registered with the Marrakech Trade Register under number 156523, ICE 003596220000030, whose registered office is located at 5th floor, Centre d’affaires Sara, 23 avenue Yacoub Mansour, Marrakech, Morocco.\n\n' +
      'Establishment: {salon}, {adresse}.\n\n' +
      'Publication director: Meryem. Contact: {email} — {telephone}.',
  },
  {
    id: 'hebergement',
    title: 'Hosting',
    body: 'The website is hosted by IONOS SE, Elgendorfer Str. 57, 56410 Montabaur, Germany.',
  },
  {
    id: 'conditions',
    title: 'Booking terms',
    body:
      'Appointments can be booked online via our booking page, by phone on {telephone} or on WhatsApp.\n\n' +
      'If you are unable to attend, please let us know at least 24 hours in advance so that we can offer your slot to another client.\n\n' +
      'Please arrive a few minutes before your appointment. If you are significantly late, the treatment may be shortened so as not to penalise the following clients.\n\n' +
      'The prices shown on the website are for guidance only and may change: the price applied is the one in force on the day of the treatment.',
  },
  {
    id: 'propriete',
    title: 'Intellectual property',
    body: 'The logo, monogram, texts, photographs and visual identity of {salon} are protected. Any reproduction without prior authorisation is prohibited.',
  },
  {
    id: 'confidentialite',
    title: 'Privacy policy',
    body:
      'The information entered on the website (contact form, reviews, newsletter sign-up) is used solely to reply to your request, to send you our news if you have signed up and, for reviews, to publish them after approval (first name and text only).\n\n' +
      'Online booking is provided by our Dikidi booking system, which applies its own privacy policy.\n\n' +
      'You can unsubscribe from the newsletter at any time using the link included in every email.\n\n' +
      'Your data is stored securely and is never sold. In accordance with Moroccan law 09-08 on the protection of individuals with regard to the processing of personal data, you may request access to, correction or deletion of your data by writing to us at {email}.\n\n' +
      `The processing of personal data carried out through this website has been declared to the Moroccan data protection authority (CNDP — Commission nationale de contrôle de la protection des données à caractère personnel)${CNDP_REF ? `, under no. ${CNDP_REF}` : ''}, in accordance with law no. 09-08.`,
  },
  {
    id: 'cookies',
    title: 'Cookies',
    body:
      'This website does not use advertising cookies or trackers. Clicks on the “Book” buttons are counted anonymously, without cookies, for our statistics. ' +
      'Fonts are loaded from Google Fonts and the location map from Google Maps.',
  },
];

export type LegalBlock = { kind: 'p'; text: string } | { kind: 'ul'; items: string[] };

/** Remplace les mots-clés par les coordonnées du salon. */
export function legalVars(text: string, s: Settings): string {
  return text
    .replaceAll('{salon}', s.salon_name || 'OPAAL Beauty Club')
    .replaceAll('{adresse}', fullAddress(s))
    .replaceAll('{email}', s.email)
    .replaceAll('{telephone}', s.phone);
}

/** Texte simple → paragraphes et listes. */
export function legalBlocks(text: string): LegalBlock[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length)
    .map((lines): LegalBlock =>
      lines.every((l) => /^[-•]\s+/.test(l))
        ? { kind: 'ul', items: lines.map((l) => l.replace(/^[-•]\s+/, '')) }
        : { kind: 'p', text: lines.join('\n') },
    );
}
