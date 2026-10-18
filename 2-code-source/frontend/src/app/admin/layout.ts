import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SeoService } from '../core/seo.service';
import { MonoComponent, WordmarkComponent } from '../shared/ui';
import { AuthService } from './auth';
import { AdminApi } from './admin-api';
import { AdmIconComponent, Toaster } from './admin-shared';
import { errorMessage } from '../core/api.service';
import { MediaPickerComponent } from './media';
import { ADMIN_I18N } from './admin-i18n';
import { I18nService, mark } from '../core/i18n';

const LINKS = [
  { path: '/admin', label: mark('Tableau de bord'), icon: 'home', exact: true, badge: '' },
  { path: '/admin/boite', label: mark('Boîte de réception'), icon: 'mail', exact: false, badge: '' },
  { path: '/admin/messages', label: mark('Messages du site'), icon: 'chat', exact: false, badge: 'messages' },
  { path: '/admin/avis', label: mark('Avis clientes'), icon: 'star', exact: false, badge: 'reviews' },
  { path: '/admin/tarifs', label: mark('Soins & tarifs'), icon: 'tag', exact: false, badge: '' },
  { path: '/admin/offres', label: mark('Offres & formules'), icon: 'gift', exact: false, badge: '' },
  { path: '/admin/images', label: mark('Images du site'), icon: 'image', exact: false, badge: '' },
  { path: '/admin/blog', label: mark('Blog'), icon: 'doc', exact: false, badge: '' },
  { path: '/admin/newsletter', label: mark('Newsletter'), icon: 'send', exact: false, badge: '' },
  { path: '/admin/pages', label: mark('Pages & SEO'), icon: 'globe', exact: false, badge: '' },
  { path: '/admin/langues', label: mark('Langues du site'), icon: 'lang', exact: false, badge: '' },
  { path: '/admin/coordonnees', label: mark('Coordonnées & réservation'), icon: 'pin', exact: false, badge: '' },
  { path: '/admin/emails', label: mark('E-mails (SMTP)'), icon: 'cog', exact: false, badge: '' },
  { path: '/admin/compte', label: mark('Mon compte'), icon: 'user', exact: false, badge: '' },
  { path: '/admin/aide', label: mark('Aide'), icon: 'help', exact: false, badge: '' },
] as const;

@Component({
  selector: 'app-admin-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="adm-toasts" aria-live="polite">
    @for (t of toaster.toasts(); track t.id) {<div class="adm-toast" [class.error]="t.kind === 'error'">{{ t.text }}</div>}
  </div>`,
})
export class ToastsComponent {
  protected readonly toaster = inject(Toaster);
}

/** Cadre de l'espace propriétaire : menu latéral + contenu. */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MonoComponent, WordmarkComponent, AdmIconComponent, ToastsComponent, MediaPickerComponent, ADMIN_I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm" [class.nav-open]="navOpen()">
      <aside class="adm-side">
        <a class="adm-brand" routerLink="/admin">
          <app-mono />
          <app-wordmark />
          <span>{{ 'Espace propriétaire' | tr }}</span>
        </a>
        <nav class="adm-nav" [attr.aria-label]="'Menu de l’espace propriétaire' | tr">
          @for (l of links; track l.path) {
            <a [routerLink]="l.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: l.exact }" (click)="navOpen.set(false)">
              <app-adm-icon [name]="l.icon" />
              <span>{{ l.label | tr }}</span>
              @if (l.badge && count(l.badge)) {<b class="adm-badge">{{ count(l.badge) }}</b>}
            </a>
          }
        </nav>
        <div class="adm-side-foot">
          <a href="/" target="_blank" rel="noopener"><app-adm-icon name="eye" /><span>{{ 'Voir le site' | tr }}</span></a>
          <button type="button" (click)="logout()"><app-adm-icon name="out" /><span>{{ 'Se déconnecter' | tr }}</span></button>
        </div>
      </aside>
      <div class="adm-scrim" (click)="navOpen.set(false)"></div>
      <div class="adm-main">
        <header class="adm-top">
          <button type="button" class="adm-burger" [attr.aria-label]="'Menu' | tr" (click)="navOpen.set(!navOpen())"><app-adm-icon name="menu" /></button>
          <div class="adm-top-title">{{ title() | tr }}</div>
          <div class="adm-user"><app-admin-lang /><span class="adm-avatar">{{ initial() }}</span><span class="adm-email">{{ auth.email() }}</span></div>
        </header>
        <div class="adm-content">
          <router-outlet />
        </div>
      </div>
    </div>
    <app-admin-toasts />
    <app-media-picker />
  `,
})
export class AdminLayout {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);
  protected readonly links = LINKS;
  protected readonly navOpen = signal(false);
  protected readonly title = signal('Tableau de bord');
  protected readonly initial = computed(() => (this.auth.email()[0] ?? 'O').toUpperCase());

  constructor() {
    const i18n = inject(I18nService);
    inject(SeoService).set({ title: i18n.tr('Espace propriétaire — OPAAL'), description: i18n.tr('Espace propriétaire OPAAL Beauty Club.'), path: '/admin', noindex: true });
    const update = () => {
      let s = this.router.routerState.snapshot.root;
      while (s.firstChild) s = s.firstChild;
      const t = s.data?.['title'] as string | undefined;
      if (t) this.title.set(t);
    };
    update();
    this.router.events.pipe(takeUntilDestroyed()).subscribe((e) => {
      if (e instanceof NavigationEnd) {
        update();
        void this.api.refreshBadges();
      }
    });
    void this.api.refreshBadges();
  }

  protected count(key: string): number {
    const b = this.api.badges() as Record<string, number>;
    return b[key] ?? 0;
  }

  protected async logout(): Promise<void> {
    try {
      await this.api.logout();
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
    this.auth.clear();
    void this.router.navigate(['/admin/connexion']);
  }
}
