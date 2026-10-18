import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdmIconComponent } from './admin-shared';
import { ADMIN_I18N } from './admin-i18n';
import { mark } from '../core/i18n';

/** Guide d'utilisation de l'espace propriétaire. */
@Component({
  selector: 'app-admin-help',
  imports: [RouterLink, AdmIconComponent, ADMIN_I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-page-head">
      <div>
        <h1>{{ 'Aide' | tr }}</h1>
        <p class="adm-muted">{{ 'Les réponses aux questions les plus courantes pour gérer votre site au quotidien.' | tr }}</p>
      </div>
    </div>
    <div class="adm-help">
      @for (g of guides; track g.q; let i = $index) {
        <section class="adm-card adm-help-item" [class.open]="open() === i">
          <button type="button" class="adm-help-q" [attr.aria-expanded]="open() === i" (click)="open.set(open() === i ? null : i)">
            <app-adm-icon [name]="g.icon" /><span>{{ g.q | tr }}</span><i class="chev" aria-hidden="true"></i>
          </button>
          @if (open() === i) {
            <div class="adm-help-a">
              <ol>@for (s of g.steps; track $index) {<li>{{ s | tr }}</li>}</ol>
              @if (g.link) {<a class="adm-btn sm" [routerLink]="g.link">{{ g.linkLabel | tr }} →</a>}
            </div>
          }
        </section>
      }
    </div>
  `,
})
export class HelpPage {
  protected readonly open = signal<number | null>(0);
  protected readonly guides = [
    {
      icon: 'calendar', q: mark('Comment fonctionnent les réservations ?'), link: '/admin/coordonnees', linkLabel: mark('Lien de réservation'),
      steps: [
        mark('Tous les boutons « Réserver » du site ouvrent votre agenda en ligne Dikidi dans un nouvel onglet : les rendez-vous se gèrent dans Dikidi.'),
        mark('Pour changer ce lien : « Coordonnées & réservation » → « Réservation en ligne ».'),
        mark('Le tableau de bord indique combien de fois les clientes ont cliqué sur « Réserver » (et sur quels soins).'),
        mark('Les demandes « Devenir membre » ouvrent WhatsApp avec un message pré-rempli.'),
      ],
    },
    {
      icon: 'lang', q: mark('Site en français et en anglais'), link: '/admin/langues', linkLabel: mark('Langues du site'),
      steps: [
        mark('Le site existe en français (adresses habituelles, ex. /soins) et en anglais (adresses en /en, ex. /en/soins). Les visiteurs changent de langue avec « FR | EN » en haut du site.'),
        mark('« Langues du site » : activez ou désactivez la version anglaise. Désactivée, elle disparaît du site et de Google, et ses adresses renvoient vers la page française.'),
        mark('Pour traduire vos contenus, cliquez sur « English » en haut des pages Soins & tarifs, Offres, Blog, Images, Pages & SEO, Coordonnées et Newsletter. Un champ anglais laissé vide affiche le texte français.'),
        mark('Les textes fixes du site (menus, boutons, pages) sont déjà traduits. Les soins, formules et articles d’origine ont aussi leur traduction : relisez-les et adaptez-les.'),
        mark('La langue de cet espace (menus, boutons) se choisit avec « FR | EN » en haut à droite : elle ne change rien au site.'),
        mark('Les clientes reçoivent les e-mails automatiques dans la langue du site qu’elles ont utilisé ; les messages et avis venus du site anglais portent l’étiquette EN.'),
      ],
    },
    {
      icon: 'tag', q: mark('Modifier un prix, une description ou ajouter un soin'), link: '/admin/tarifs', linkLabel: mark('Soins & tarifs'),
      steps: [
        mark('Ouvrez « Soins & tarifs » puis la catégorie voulue.'),
        mark('Modifiez le nom, le prix, la durée ou la description : la ligne devient jaune, cliquez sur « Enregistrer ».'),
        mark('Prix vide = « Sur demande » sur le site. Activez « À partir de » pour afficher « À partir de 300 DH ».'),
        mark('« Ajouter un soin » crée un soin masqué : complétez-le puis activez « Visible ».'),
      ],
    },
    {
      icon: 'image', q: mark('Changer une photo du site'), link: '/admin/images', linkLabel: mark('Images du site'),
      steps: [
        mark('Ouvrez « Images du site » : chaque section (accueil, cartes, page Soins, en-têtes) a sa photo.'),
        mark('Cliquez sur « Changer la photo », puis choisissez une photo existante ou « Envoyer des photos » depuis votre téléphone ou ordinateur.'),
        mark('Ajustez le cadrage si besoin (haut, centre, bas) et décrivez la photo (texte alternatif, utile pour Google).'),
        mark('Cliquez sur « Enregistrer les photos » : le site est mis à jour immédiatement. « Remettre l’originale » annule le changement.'),
        mark('Les onglets « Galerie » et « Publications de l’accueil » permettent d’ajouter, retirer et réordonner les photos.'),
      ],
    },
    {
      icon: 'doc', q: mark('Écrire un article de blog'), link: '/admin/blog', linkLabel: mark('Blog'),
      steps: [
        mark('Trois articles sont déjà prêts en brouillon : relisez-les, adaptez-les si besoin et cliquez sur « Publier ».'),
        mark('« Nouvel article » : un titre clair (le soin + Marrakech), une image de couverture, un résumé et le texte.'),
        mark('Utilisez les boutons Intertitre, Gras, Liste, Lien et Image ; l’aperçu à droite montre le rendu.'),
        mark('Remplissez le titre et la description Google (l’aperçu indique si c’est trop long).'),
        mark('Un article publié devient une page du site, ajoutée automatiquement au plan du site pour Google. Visez 1 à 2 articles par mois.'),
      ],
    },
    {
      icon: 'send', q: mark('Envoyer une newsletter'), link: '/admin/newsletter', linkLabel: mark('Newsletter'),
      steps: [
        mark('Les clientes s’inscrivent depuis le pied de page du site. Vous pouvez aussi coller une liste d’adresses dans « Abonnées ».'),
        mark('Dans « Campagnes », cliquez sur « Nouvelle campagne », écrivez l’objet et le texte, puis « Aperçu ».'),
        mark('Envoyez-vous toujours un test avant l’envoi réel.'),
        mark('Cliquez sur « Envoyer à … abonnées » et gardez la page ouverte pendant l’envoi (quelques minutes pour quelques centaines d’adresses).'),
        mark('Chaque e-mail contient un lien de désinscription : les désinscrites ne reçoivent plus rien.'),
      ],
    },
    {
      icon: 'globe', q: mark('Améliorer le référencement Google (SEO)'), link: '/admin/pages', linkLabel: mark('Pages & SEO'),
      steps: [
        mark('Dans « Pages & SEO », personnalisez le titre et la description de chaque page. L’aperçu montre le rendu dans Google.'),
        mark('Mettez les mots que vos clientes tapent : le soin + « Marrakech » (ex. « Massage relaxant à Marrakech »).'),
        mark('Créez et complétez votre fiche Google Business Profile (même adresse et même téléphone que sur le site) et demandez des avis Google.'),
        mark('Google met quelques jours à prendre en compte les modifications.'),
      ],
    },
    {
      icon: 'doc', q: mark('Compléter les mentions légales et les conditions'), link: '/admin/pages', linkLabel: mark('Mentions & conditions'),
      steps: [
        mark('Ouvrez « Pages & SEO » → « Mentions & conditions ».'),
        mark('Remplacez les éléments entre crochets [ ] (nom de la société, RC / ICE, responsable).'),
        mark('Adaptez les conditions de rendez-vous (délai d’annulation, retards…) à votre fonctionnement.'),
      ],
    },
    {
      icon: 'star', q: mark('Obtenir plus d’avis clients'), link: '/admin/avis', linkLabel: mark('Avis clientes'),
      steps: [
        mark('Après un soin, ouvrez « Avis clientes » → « Demander un avis », indiquez le prénom et le soin, puis cliquez sur « Envoyer sur WhatsApp » (ou par e-mail / SMS).'),
        mark('La cliente arrive sur la page opaalbeautyclub.com/avis avec son prénom et son soin déjà remplis : une note et quelques mots suffisent.'),
        mark('Imprimez le QR code et posez-le à l’accueil : les clientes le scannent avec leur téléphone.'),
        mark('Ajoutez le lien de votre fiche Google dans « Coordonnées & réservation » : après un avis 4 ou 5 ★, la cliente est invitée à le publier aussi sur Google.'),
        mark('Les avis laissés sur le site n’apparaissent qu’après votre validation : cliquez sur « Publier ». Vous pouvez aussi recopier un avis reçu sur Google ou Instagram, avec sa date.'),
      ],
    },
    {
      icon: 'cog', q: mark('Les e-mails ne partent pas'), link: '/admin/emails', linkLabel: mark('E-mails (SMTP)'),
      steps: [
        mark('Ouvrez « E-mails (SMTP) » et envoyez un e-mail de test : le message d’erreur indique la cause.'),
        mark('Mot de passe refusé : saisissez à nouveau le mot de passe de la boîte contact@… puis enregistrez.'),
        mark('Connexion impossible : essayez le port 587 avec « TLS », ou le serveur smtp.ionos.com.'),
        mark('Pensez à regarder le dossier « Indésirables » du destinataire.'),
      ],
    },
    {
      icon: 'user', q: mark('Sécurité et sauvegarde'), link: '/admin/compte', linkLabel: mark('Mon compte'),
      steps: [
        mark('Utilisez un mot de passe unique d’au moins 10 caractères (lettres et chiffres).'),
        mark('En cas d’oubli : « Mot de passe oublié ? » sur l’écran de connexion.'),
        mark('Toutes les données (messages, avis, tarifs, abonnées) sont dans le fichier api/data/opaal.sqlite : téléchargez-le de temps en temps par FTP pour en garder une copie.'),
        mark('Lors d’une mise à jour du site, n’écrasez jamais le dossier api/data ni le fichier api/config.php.'),
      ],
    },
  ];
}
