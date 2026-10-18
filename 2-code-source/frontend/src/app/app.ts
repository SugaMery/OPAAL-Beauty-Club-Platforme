import { ChangeDetectionStrategy, Component, afterNextRender, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Location } from '@angular/common';
import { FxService } from './core/fx';
import { ContentService } from './core/content.service';
import { I18N, I18nService, stripLang } from './core/i18n';
import { HeaderComponent } from './shared/header';
import { FooterComponent } from './shared/layout';
import { CursorComponent, LightboxComponent, ToTopComponent } from './shared/overlays';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent, LightboxComponent, CursorComponent, ToTopComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!admin()) {
      <div class="progress" aria-hidden="true"></div>
      <a class="skip" href="#main">{{ 'Aller au contenu' | tr }}</a>
      <app-header />
    }
    <main id="main" [class.admin-main]="admin()">
      <router-outlet />
    </main>
    @if (!admin()) {
      <app-footer />
      <app-lightbox />
      <app-to-top />
      <app-cursor />
    }
  `,
})
export class App {
  private readonly router = inject(Router);
  private readonly fx = inject(FxService);
  private readonly content = inject(ContentService);
  private readonly i18n = inject(I18nService);
  protected readonly admin = signal(inject(Location).path().startsWith('/admin'));

  constructor() {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.admin.set(e.urlAfterRedirects.startsWith('/admin'));
        this.fx.refresh();
      }
    });
    // Version anglaise désactivée dans l'espace propriétaire : les adresses /en/… mènent à la page française.
    effect(() => {
      if (this.content.loaded() && !this.content.englishEnabled() && this.i18n.siteLang() === 'en' && !this.i18n.isAdmin()) {
        void this.router.navigateByUrl(stripLang(this.router.url), { replaceUrl: true });
      }
    });
    afterNextRender(() => {
      this.fx.start();
      this.content.load();
      (window as unknown as { __opaalBooted?: boolean }).__opaalBooted = true;
    });
  }
}
