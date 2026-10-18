import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SeoService } from '../core/seo.service';
import { errorMessage } from '../core/api.service';
import { I18nService } from '../core/i18n';
import { MonoComponent, WordmarkComponent } from '../shared/ui';
import { AuthService } from './auth';
import { AdminApi } from './admin-api';
import { ADMIN_I18N } from './admin-i18n';

@Component({
  selector: 'app-admin-login',
  imports: [FormsModule, RouterLink, MonoComponent, WordmarkComponent, ADMIN_I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-auth">
      <div class="adm-auth-card">
        <app-mono />
        <app-wordmark />
        <p class="adm-auth-tag">{{ 'Espace propriétaire' | tr }}</p>
        <div class="adm-auth-lang"><app-admin-lang /></div>
        @if (mode() === 'login') {
          <h1>{{ 'Connexion' | tr }}</h1>
          @if (expired) {<p class="adm-info">{{ 'Votre session a expiré, merci de vous reconnecter.' | tr }}</p>}
          <form (ngSubmit)="login()" class="adm-form">
            <label>{{ 'E-mail' | tr }}<input name="email" type="email" autocomplete="username" [(ngModel)]="email" required /></label>
            <label>{{ 'Mot de passe' | tr }}
              <span class="adm-pw">
                <input name="password" [type]="show() ? 'text' : 'password'" autocomplete="current-password" [(ngModel)]="password" required />
                <button type="button" (click)="show.set(!show())">{{ (show() ? 'Masquer' : 'Afficher') | tr }}</button>
              </span>
            </label>
            @if (error()) {<p class="adm-error" role="alert">{{ error() }}</p>}
            <button class="adm-btn primary block" type="submit" [disabled]="busy()">{{ (busy() ? 'Connexion…' : 'Se connecter') | tr }}</button>
          </form>
          <button type="button" class="adm-link" (click)="mode.set('forgot'); error.set('')">{{ 'Mot de passe oublié ?' | tr }}</button>
        } @else {
          <h1>{{ 'Mot de passe oublié' | tr }}</h1>
          @if (sent()) {
            <p class="adm-info">{{ 'Si cette adresse correspond au compte, un e-mail avec un lien de réinitialisation vient d’être envoyé. Pensez à vérifier les courriers indésirables.' | tr }}</p>
          } @else {
            <p class="adm-muted">{{ 'Indiquez l’e-mail du compte : vous recevrez un lien pour choisir un nouveau mot de passe.' | tr }}</p>
            <form (ngSubmit)="forgot()" class="adm-form">
              <label>{{ 'E-mail' | tr }}<input name="email" type="email" autocomplete="username" [(ngModel)]="email" required /></label>
              @if (error()) {<p class="adm-error" role="alert">{{ error() }}</p>}
              <button class="adm-btn primary block" type="submit" [disabled]="busy()">{{ 'Recevoir le lien' | tr }}</button>
            </form>
          }
          <button type="button" class="adm-link" (click)="mode.set('login'); sent.set(false)">← {{ 'Retour à la connexion' | tr }}</button>
        }
        <a class="adm-back" routerLink="/">{{ 'Retour au site' | tr }}</a>
      </div>
    </div>
  `,
})
export class LoginPage {
  private readonly api = inject(AdminApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly mode = signal<'login' | 'forgot'>('login');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly sent = signal(false);
  protected readonly show = signal(false);
  protected readonly expired = !!inject(ActivatedRoute).snapshot.queryParamMap.get('expire');
  protected email = '';
  protected password = '';

  constructor() {
    const i18n = inject(I18nService);
    inject(SeoService).set({
      title: i18n.tr('Connexion — Espace propriétaire OPAAL'),
      description: i18n.tr('Connexion à l’espace propriétaire.'),
      path: '/admin/connexion',
      noindex: true,
    });
    if (this.auth.loggedIn()) {
      void this.router.navigate(['/admin']);
    }
  }

  protected async login(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      const s = await this.api.login(this.email, this.password);
      this.auth.save(s);
      void this.router.navigate(['/admin']);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async forgot(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.forgot(this.email);
      this.sent.set(true);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'app-admin-reset',
  imports: [FormsModule, RouterLink, MonoComponent, WordmarkComponent, ADMIN_I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-auth">
      <div class="adm-auth-card">
        <app-mono />
        <app-wordmark />
        <p class="adm-auth-tag">{{ 'Espace propriétaire' | tr }}</p>
        <div class="adm-auth-lang"><app-admin-lang /></div>
        <h1>{{ 'Nouveau mot de passe' | tr }}</h1>
        <p class="adm-muted">{{ 'Au moins 10 caractères, avec des lettres et des chiffres.' | tr }}</p>
        <form (ngSubmit)="save()" class="adm-form">
          <label>{{ 'Nouveau mot de passe' | tr }}<input name="p1" type="password" autocomplete="new-password" [(ngModel)]="p1" required /></label>
          <label>{{ 'Confirmer' | tr }}<input name="p2" type="password" autocomplete="new-password" [(ngModel)]="p2" required /></label>
          @if (error()) {<p class="adm-error" role="alert">{{ error() }}</p>}
          <button class="adm-btn primary block" type="submit" [disabled]="busy()">{{ 'Enregistrer et me connecter' | tr }}</button>
        </form>
        <a class="adm-back" routerLink="/admin/connexion">{{ 'Retour à la connexion' | tr }}</a>
      </div>
    </div>
  `,
})
export class ResetPage {
  private readonly api = inject(AdminApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('jeton') ?? '';
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected p1 = '';
  protected p2 = '';

  constructor() {
    inject(SeoService).set({
      title: this.i18n.tr('Nouveau mot de passe — OPAAL'),
      description: this.i18n.tr('Réinitialisation du mot de passe.'),
      path: '/admin/reinitialiser',
      noindex: true,
    });
  }

  protected async save(): Promise<void> {
    if (this.p1 !== this.p2) {
      this.error.set(this.i18n.tr('Les deux mots de passe ne correspondent pas.'));
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const res = await this.api.reset(this.token, this.p1);
      this.auth.save({ token: res.token, expires_at: res.expires_at, email: '' });
      const me = await this.api.me();
      this.auth.save({ token: res.token, expires_at: res.expires_at, email: me.email });
      void this.router.navigate(['/admin']);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
