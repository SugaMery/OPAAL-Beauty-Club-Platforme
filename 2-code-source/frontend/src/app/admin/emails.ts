import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorMessage } from '../core/api.service';
import { AdminApi, MailLog, SmtpSettings } from './admin-api';
import { AdmIconComponent, Toaster, when } from './admin-shared';
import { ADMIN_I18N } from './admin-i18n';
import { I18nService } from '../core/i18n';

/** Réglages d'envoi des e-mails (serveur SMTP IONOS) + e-mail de test + historique. */
@Component({
  selector: 'app-admin-emails',
  imports: [FormsModule, AdmIconComponent, ADMIN_I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-page-head">
      <div>
        <h1>{{ 'E-mails (SMTP)' | tr }}</h1>
        <p class="adm-muted">{{ 'Le site envoie ses e-mails (notifications, confirmations, newsletter) via votre boîte IONOS. Modifiez ici les réglages, puis vérifiez avec un e-mail de test.' | tr }}
          {{ 'Les clientes reçoivent les e-mails automatiques dans la langue du site qu’elles ont utilisé (français ou anglais) ; vous, dans la langue de votre espace propriétaire.' | tr }}</p>
      </div>
    </div>

    @if (smtp(); as st) {
      <div class="adm-grid-2 adm-grid-top">
        <form class="adm-card" (ngSubmit)="save()">
          <h2>{{ 'Serveur d’envoi' | tr }}</h2>
          <div class="adm-row2">
            <label>{{ 'Serveur SMTP' | tr }}<input name="host" [(ngModel)]="st.host" placeholder="smtp.ionos.fr" /></label>
            <label>{{ 'Sécurité' | tr }}
              <select name="enc" [(ngModel)]="st.encryption" (ngModelChange)="suggestPort($event)">
                <option value="ssl">SSL · port 465</option>
                <option value="tls">TLS · port 587</option>
                <option value="none">{{ 'Aucune' | tr }}</option>
              </select>
            </label>
            <label>{{ 'Port' | tr }}<input name="port" type="number" min="1" max="65535" [(ngModel)]="st.port" /></label>
            <label>{{ 'Identifiant' | tr }} <em>{{ '(adresse de la boîte)' | tr }}</em><input name="user" autocomplete="off" [(ngModel)]="st.username" /></label>
            <label>{{ 'Mot de passe de la boîte e-mail' | tr }}
              <input name="pw" type="password" autocomplete="new-password" [(ngModel)]="password" [placeholder]="(st.has_password ? '•••••••• (inchangé)' : 'Mot de passe') | tr" />
            </label>
            <label>{{ 'Adresse d’expédition' | tr }}<input name="from" type="email" [(ngModel)]="st.from_email" /></label>
            <label>{{ 'Nom d’expéditeur' | tr }}<input name="fromname" [(ngModel)]="st.from_name" placeholder="OPAAL Beauty Club" /></label>
          </div>
          <p class="adm-hint">{{ 'Laissez le mot de passe vide pour garder celui déjà enregistré. Chez IONOS : smtp.ionos.fr (ou smtp.ionos.com), port 465 en SSL.' | tr }}</p>
          <div class="adm-actions">
            <button class="adm-btn primary" type="submit" [disabled]="busy()">{{ (busy() ? 'Enregistrement…' : 'Enregistrer les réglages') | tr }}</button>
          </div>
        </form>

        <section class="adm-card">
          <h2>{{ 'E-mail de test' | tr }}</h2>
          <p class="adm-muted">{{ 'Envoyez un e-mail de test à l’adresse de votre choix. Le test utilise les réglages ci-contre, même s’ils ne sont pas encore enregistrés.' | tr }}</p>
          <label>{{ 'Envoyer à' | tr }}<input type="email" name="to" [(ngModel)]="to" [placeholder]="st.notify_email || ('votre@adresse.com' | tr)" /></label>
          <button type="button" class="adm-btn primary" (click)="test()" [disabled]="testing()"><app-adm-icon name="send" /> {{ (testing() ? 'Envoi…' : 'Envoyer un e-mail de test') | tr }}</button>
          @if (result(); as r) {
            <p [class]="r.ok ? 'adm-info' : 'adm-error'" style="margin-top: 14px" role="status">{{ r.text }}</p>
          }
          <p class="adm-muted" style="margin-top: 16px">{{ 'Les notifications (messages, avis) sont envoyées à' | tr }} <b>{{ st.notify_email }}</b> — {{ 'modifiable dans « Coordonnées & réservation ».' | tr }}</p>
        </section>
      </div>

      <section class="adm-card">
        <header class="adm-card-head"><h2>{{ 'Historique des envois' | tr }}</h2><button type="button" class="adm-btn sm" (click)="loadLog()">{{ 'Actualiser' | tr }}</button></header>
        @if (log().length) {
          <ul class="adm-log">
            @for (l of log(); track $index) {
              <li [class.fail]="l.status !== 'envoye'">
                <span class="dot"></span>
                <div><strong>{{ l.subject }}</strong><span>{{ l.to_addr }} · {{ when(l.created_at) }}</span>
                  @if (l.error) {<em>{{ l.error }}</em>}
                </div>
              </li>
            }
          </ul>
        } @else {
          <p class="adm-empty">{{ 'Aucun e-mail envoyé pour le moment.' | tr }}</p>
        }
      </section>
    } @else {
      <div class="adm-loading"><span></span><span></span><span></span></div>
    }
  `,
})
export class EmailsPage {
  private readonly api = inject(AdminApi);
  private readonly toaster = inject(Toaster);
  private readonly i18n = inject(I18nService);
  protected readonly smtp = signal<SmtpSettings | null>(null);
  protected readonly log = signal<MailLog[]>([]);
  protected readonly busy = signal(false);
  protected readonly testing = signal(false);
  protected readonly result = signal<{ ok: boolean; text: string } | null>(null);
  protected readonly when = when;
  protected password = '';
  protected to = '';

  constructor() {
    void this.load();
    void this.loadLog();
  }

  private async load(): Promise<void> {
    try {
      this.smtp.set(await this.api.smtp());
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected async loadLog(): Promise<void> {
    try {
      this.log.set(await this.api.mailLog());
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected suggestPort(enc: string): void {
    const st = this.smtp();
    if (!st) return;
    if (enc === 'ssl' && st.port === 587) st.port = 465;
    if (enc === 'tls' && st.port === 465) st.port = 587;
  }

  private payload(st: SmtpSettings): SmtpSettings {
    return {
      host: st.host, port: Number(st.port), encryption: st.encryption, username: st.username,
      password: this.password, from_email: st.from_email, from_name: st.from_name,
    };
  }

  protected async save(): Promise<void> {
    const st = this.smtp();
    if (!st) return;
    this.busy.set(true);
    try {
      this.smtp.set(await this.api.saveSmtp(this.payload(st)));
      this.password = '';
      this.toaster.ok(this.i18n.tr('Réglages e-mail enregistrés.'));
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async test(): Promise<void> {
    const st = this.smtp();
    if (!st) return;
    this.testing.set(true);
    this.result.set(null);
    try {
      const r = await this.api.testEmail(this.to.trim(), this.payload(st));
      this.result.set(
        r.ok
          ? { ok: true, text: this.i18n.tr('E-mail de test envoyé à {email}. Vérifiez la boîte de réception (et les indésirables).', { email: r.to }) }
          : { ok: false, text: this.i18n.tr('Échec de l’envoi : {error}', { error: r.error }) },
      );
      await this.loadLog();
    } catch (e) {
      this.result.set({ ok: false, text: errorMessage(e) });
    } finally {
      this.testing.set(false);
    }
  }
}
