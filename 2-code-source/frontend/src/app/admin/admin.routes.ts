import { Routes } from '@angular/router';
import { authGuard } from './auth';
import { AdminLayout } from './layout';
import { LoginPage, ResetPage } from './auth-pages';
import { DashboardPage } from './dashboard';
import { MessagesPage } from './messages';
import { InboxPage } from './inbox';
import { ReviewsAdminPage } from './reviews';
import { TarifsPage } from './tarifs';
import { OffersPage } from './offers';
import { NewsletterPage } from './newsletter';
import { ImagesPage } from './images';
import { BlogAdminPage } from './blog';
import { PagesSeoPage } from './pages-seo';
import { SettingsPage } from './settings';
import { EmailsPage } from './emails';
import { AccountPage } from './account';
import { HelpPage } from './help';
import { LanguagesPage } from './languages';
import { mark } from '../core/i18n';

export const ADMIN_ROUTES: Routes = [
  { path: 'connexion', component: LoginPage },
  { path: 'reinitialiser', component: ResetPage },
  {
    path: '',
    component: AdminLayout,
    canActivate: [authGuard],
    children: [
      { path: '', component: DashboardPage, data: { title: mark('Tableau de bord') } },
      { path: 'boite', component: InboxPage, data: { title: mark('Boîte de réception') } },
      { path: 'messages', component: MessagesPage, data: { title: mark('Messages du site') } },
      { path: 'avis', component: ReviewsAdminPage, data: { title: mark('Avis clientes') } },
      { path: 'tarifs', component: TarifsPage, data: { title: mark('Soins & tarifs') } },
      { path: 'offres', component: OffersPage, data: { title: mark('Offres & formules') } },
      { path: 'images', component: ImagesPage, data: { title: mark('Images du site') } },
      { path: 'blog', component: BlogAdminPage, data: { title: mark('Blog') } },
      { path: 'newsletter', component: NewsletterPage, data: { title: mark('Newsletter') } },
      { path: 'pages', component: PagesSeoPage, data: { title: mark('Pages & SEO') } },
      { path: 'langues', component: LanguagesPage, data: { title: mark('Langues du site') } },
      { path: 'coordonnees', component: SettingsPage, data: { title: mark('Coordonnées & réservation') } },
      { path: 'emails', component: EmailsPage, data: { title: mark('E-mails (SMTP)') } },
      { path: 'compte', component: AccountPage, data: { title: mark('Mon compte') } },
      { path: 'aide', component: HelpPage, data: { title: mark('Aide') } },
      { path: 'reservations', redirectTo: '', pathMatch: 'full' },
    ],
  },
];
