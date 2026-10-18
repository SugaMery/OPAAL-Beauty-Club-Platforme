import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Pages publiques (français et anglais) : pré-rendues en HTML au moment du build (idéal pour le référencement Google).
 * Espace propriétaire : rendu uniquement dans le navigateur (jamais indexé).
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
  // Articles : écrits en HTML statique par le serveur à chaque publication (voir api/src/Blog.php)
  { path: 'blog/:slug', renderMode: RenderMode.Client },
  { path: 'en/blog/:slug', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];
