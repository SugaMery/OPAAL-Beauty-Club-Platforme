import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorMessage } from '../core/api.service';
import { AuthService } from './auth';
import { AdminApi } from './admin-api';
import { Toaster } from './admin-shared';
import { ADMIN_I18N } from './admin-i18n';
import { I18nService } from '../core/i18n';

@Component({
  selector: 'app-admin-account',
  imports: [FormsModule, ADMIN_I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-page-head"><div><h1>{{ 'Mon compte' | tr }}</h1><p class="adm-muted">{{ 'Identifiant de connexion :' | tr }} <b>{{ auth.email() }}</b></p></div></div>
    <section class="adm-card adm-narrow">
      <h2>{{ 'Langue de l’espace propriétaire' | tr }}</h2>
      <p class="adm-muted">{{ 'Menus, boutons et messages de cet espace. Les e-mails qui vous sont destinés (nouveau message, nouvel avis) partent aussi dans cette langue.' | tr }}</p>
      <app-admin-lang />
    </section>
    <form class="adm-card adm-narrow" (ngSubmit)="save()">
      <h2>{{ 'Changer le mot de passe' | tr }}</h2>
      <p class="adm-muted">{{ 'Au moins 10 caractères, avec des lettres et des chiffres. Vos autres appareils seront déconnectés.' | tr }}</p>
      <label>{{ 'Mot de passe actuel' | tr }}<input name="current" type="password" autocomplete="current-password" [(ngModel)]="current" required /></label>
      <label>{{ 'Nouveau mot de passe' | tr }}<input name="p1" type="password" autocomplete="new-password" [(ngModel)]="p1" required /></label>
      <label>{{ 'Confirmer le nouveau mot de passe' | tr }}<input name="p2" type="password" autocomplete="new-password" [(ngModel)]="p2" required /></label>
      @if (error()) {<p class="adm-error" role="alert">{{ error() }}</p>}
      <button class="adm-btn primary" type="submit" [disabled]="busy()">{{ 'Changer le mot de passe' | tr }}</button>
    </form>
    <section class="adm-card adm-narrow">
      <h2>{{ 'Mot de passe oublié ?' | tr }}</h2>
      <p class="adm-muted">{{ 'Depuis l’écran de connexion, cliquez sur « Mot de passe oublié » : un lien vous sera envoyé par e-mail à {email}.' | tr: { email: auth.email() } }}</p>
    </section>
  `,
})
export class AccountPage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(AdminApi);
  private readonly toaster = inject(Toaster);
  private readonly i18n = inject(I18nService);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected current = '';
  protected p1 = '';
  protected p2 = '';

  protected async save(): Promise<void> {
    this.error.set('');
    if (this.p1 !== this.p2) {
      this.error.set(this.i18n.tr('Les deux nouveaux mots de passe ne correspondent pas.'));
      return;
    }
    this.busy.set(true);
    try {
      await this.api.changePassword(this.current, this.p1);
      this.current = this.p1 = this.p2 = '';
      this.toaster.ok(this.i18n.tr('Mot de passe modifié.'));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
