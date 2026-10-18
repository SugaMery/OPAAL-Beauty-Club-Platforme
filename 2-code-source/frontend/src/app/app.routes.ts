import { Routes } from '@angular/router';
import { HomePage } from './pages/home';

/** Pages du site public : en français à la racine (/soins), en anglais sous /en (/en/soins). */
const PAGES: Routes = [
  { path: '', component: HomePage },
  { path: 'soins', loadComponent: () => import('./pages/soins').then((m) => m.SoinsPage) },
  { path: 'membership', loadComponent: () => import('./pages/membership').then((m) => m.MembershipPage) },
  { path: 'a-propos', loadComponent: () => import('./pages/about').then((m) => m.AboutPage) },
  { path: 'galerie', loadComponent: () => import('./pages/gallery').then((m) => m.GalleryPage) },
  { path: 'carte-cadeau', loadComponent: () => import('./pages/gift').then((m) => m.GiftPage) },
  { path: 'contact', loadComponent: () => import('./pages/contact').then((m) => m.ContactPage) },
  { path: 'avis', loadComponent: () => import('./pages/avis').then((m) => m.AvisPage) },
  { path: 'blog', loadComponent: () => import('./pages/blog').then((m) => m.BlogPage) },
  { path: 'blog/:slug', loadComponent: () => import('./pages/blog-post').then((m) => m.BlogPostPage) },
  { path: 'mentions-legales', loadComponent: () => import('./pages/legal').then((m) => m.LegalPage) },
  { path: 'erreur-404', loadComponent: () => import('./pages/not-found').then((m) => m.NotFoundPage) },
];

const NOT_FOUND: Routes = [{ path: '**', loadComponent: () => import('./pages/not-found').then((m) => m.NotFoundPage) }];

export const routes: Routes = [
  { path: 'admin', loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES) },
  { path: 'en', children: [...PAGES, ...NOT_FOUND] },
  ...PAGES,
  ...NOT_FOUND,
];
