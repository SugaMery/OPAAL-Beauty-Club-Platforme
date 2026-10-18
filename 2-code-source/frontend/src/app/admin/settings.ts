import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorMessage } from '../core/api.service';
import { ContentService } from '../core/content.service';
import { Settings } from '../core/models';
import { DEFAULT_BOOKING_URL } from '../core/booking.service';
import { AdminApi } from './admin-api';
import { AdmIconComponent, Toaster } from './admin-shared';
import { ADMIN_I18N, EditLang } from './admin-i18n';
import { I18nService } from '../core/i18n';

@Component({
  selector: 'app-admin-settings',
  imports: [FormsModule, AdmIconComponent, ADMIN_I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-page-head">
      <div>
        <h1>{{ 'Coordonnées & réservation' | tr }}</h1>
        <p class="adm-muted">{{ 'Ces informations apparaissent partout sur le site (en-tête, pied de page, page Contact, e-mails et fiche Google).' | tr }}</p>
      </div>
    </div>
    <app-edit-lang note="En anglais, seuls l’adresse, les horaires et le bandeau d’annonce se traduisent ; les autres réglages sont communs." />
    @if (s(); as st) {
      <form class="adm-settings" (ngSubmit)="save()">
        <section class="adm-card">
          <h2>{{ 'Réservation en ligne' | tr }}</h2>
          <p class="adm-muted">{{ 'Tous les boutons « Réserver » du site ouvrent cette page (votre agenda Dikidi) dans un nouvel onglet. Les clics sont comptés sur le tableau de bord.' | tr }}</p>
          <label>{{ 'Lien de l’agenda de réservation' | tr }}<input name="booking" type="url" [(ngModel)]="st.booking_url" placeholder="https://dikidi.net/1891924" /></label>
          <div class="adm-actions" style="margin-top: 0">
            <a class="adm-btn sm" [href]="st.booking_url || defaultBooking" target="_blank" rel="noopener"><app-adm-icon name="link" /> {{ 'Tester le lien' | tr }}</a>
            @if (st.booking_url !== defaultBooking) {
              <button type="button" class="adm-btn sm" (click)="st.booking_url = defaultBooking">{{ 'Remettre le lien Dikidi d’origine' | tr }}</button>
            }
          </div>
        </section>

        <section class="adm-card" id="avis-google">
          <h2>{{ 'Avis Google' | tr }}</h2>
          <p class="adm-muted">{{ 'Après un avis 4 ou 5 ★ laissé sur le site, la cliente est invitée à le publier aussi sur Google. Pour obtenir ce lien : ouvrez votre fiche Google Business Profile → « Demander des avis » → copiez le lien (il ressemble à https://g.page/r/…/review).' | tr }}</p>
          <label>{{ 'Lien « Laisser un avis » Google' | tr }} <em>{{ '(vide = pas de bouton Google)' | tr }}</em><input name="greview" type="url" [(ngModel)]="st.google_review_url" placeholder="https://g.page/r/…/review" /></label>
          @if (st.google_review_url) {
            <a class="adm-btn sm" [href]="st.google_review_url" target="_blank" rel="noopener"><app-adm-icon name="link" /> {{ 'Tester le lien' | tr }}</a>
          }
        </section>

        <section class="adm-card">
          <h2>{{ 'Adresse' | tr }}</h2>
          <div class="adm-row2">
            <label>{{ 'Nom du salon' | tr }}<input name="salon_name" [(ngModel)]="st.salon_name" /></label>
            <label>{{ 'Adresse (ligne 1)' | tr }}<input data-tr name="a1" [ngModel]="edit.get(st, 'address_line1')" (ngModelChange)="edit.set_(st, 'address_line1', $event)" [placeholder]="edit.ph(st, 'address_line1')" /></label>
            <label>{{ 'Adresse (ligne 2)' | tr }}<input data-tr name="a2" [ngModel]="edit.get(st, 'address_line2')" (ngModelChange)="edit.set_(st, 'address_line2', $event)" [placeholder]="edit.ph(st, 'address_line2')" /></label>
            <label>{{ 'Ville' | tr }}<input data-tr name="city" [ngModel]="edit.get(st, 'city')" (ngModelChange)="edit.set_(st, 'city', $event)" [placeholder]="edit.ph(st, 'city')" /></label>
            <label>{{ 'Pays' | tr }}<input data-tr name="country" [ngModel]="edit.get(st, 'country')" (ngModelChange)="edit.set_(st, 'country', $event)" [placeholder]="edit.ph(st, 'country')" /></label>
            <label>{{ 'Lien Google Maps' | tr }}<input name="maps" [(ngModel)]="st.maps_url" /></label>
          </div>
          <label>{{ 'Indications d’accès' | tr }} <em>{{ '(affichées sous l’adresse, page Contact ; vide = masquées)' | tr }}</em>
            <textarea data-tr name="access" rows="2" maxlength="300" [ngModel]="edit.get(st, 'access_note')" (ngModelChange)="edit.set_(st, 'access_note', $event)"
              [placeholder]="edit.ph(st, 'access_note', 'ex. Non-résidents : présentez-vous au poste de garde à l’entrée d’Amelkis.' | tr)"></textarea>
          </label>
        </section>

        <section class="adm-card">
          <h2>{{ 'Contact' | tr }}</h2>
          <div class="adm-row2">
            <label>{{ 'Téléphone affiché' | tr }}<input name="phone" [(ngModel)]="st.phone" /></label>
            <label>{{ 'Numéro WhatsApp' | tr }} <em>{{ '(format international, ex. 212648410070)' | tr }}</em><input name="wa" [(ngModel)]="st.whatsapp" /></label>
            <label>{{ 'E-mail affiché sur le site' | tr }}<input name="email" type="email" [(ngModel)]="st.email" /></label>
            <label>{{ 'E-mail qui reçoit les notifications' | tr }}<input name="notify" type="email" [(ngModel)]="st.notify_email" /></label>
          </div>
        </section>

        <section class="adm-card">
          <h2>{{ 'Horaires' | tr }}</h2>
          <p class="adm-muted">{{ 'Laissez vide pour afficher « Sur rendez-vous ».' | tr }}</p>
          @for (h of st.hours; track $index; let i = $index) {
            <div class="adm-hours-row">
              <input data-tr [name]="'days' + i" [ngModel]="edit.get(h, 'days')" (ngModelChange)="edit.set_(h, 'days', $event)" [placeholder]="edit.ph(h, 'days', 'ex. Lundi – Samedi' | tr)" />
              <input data-tr [name]="'time' + i" [ngModel]="edit.get(h, 'time')" (ngModelChange)="edit.set_(h, 'time', $event)" [placeholder]="edit.ph(h, 'time', 'ex. 10h00 – 20h00' | tr)" />
              <button type="button" class="adm-icon-btn" [attr.aria-label]="'Retirer' | tr" (click)="st.hours.splice(i, 1)"><app-adm-icon name="trash" /></button>
            </div>
          }
          @if (!edit.en()) {
            <button type="button" class="adm-btn sm" (click)="st.hours.push({ days: '', time: '' })"><app-adm-icon name="plus" /> {{ 'Ajouter une ligne' | tr }}</button>
          }
        </section>

        <section class="adm-card">
          <h2>{{ 'Réseaux sociaux' | tr }}</h2>
          <div class="adm-row2">
            <label>Instagram<input name="ig" [(ngModel)]="st.instagram" placeholder="https://instagram.com/…" /></label>
            <label>Facebook<input name="fb" [(ngModel)]="st.facebook" placeholder="https://facebook.com/…" /></label>
            <label>TikTok<input name="tt" [(ngModel)]="st.tiktok" placeholder="https://tiktok.com/@…" /></label>
            <label>Pinterest<input name="pin" [(ngModel)]="st.pinterest" placeholder="https://pinterest.com/…" /></label>
          </div>
        </section>

        <section class="adm-card">
          <h2>{{ 'Divers' | tr }}</h2>
          <div class="adm-row2">
            <label>{{ 'Devise des prix' | tr }}<input name="currency" [(ngModel)]="st.currency" placeholder="DH" /></label>
            <label>{{ 'Bandeau d’annonce en haut du site' | tr }} <em>{{ '(vide = masqué)' | tr }}</em>
              <input data-tr name="announcement" maxlength="160" [ngModel]="edit.get(st, 'announcement')" (ngModelChange)="edit.set_(st, 'announcement', $event)"
                [placeholder]="edit.ph(st, 'announcement', 'ex. Fermeture exceptionnelle le 12 mai' | tr)" />
            </label>
          </div>
        </section>

        <div class="adm-sticky-save"><button class="adm-btn primary" type="submit" [disabled]="busy()">{{ (busy() ? 'Enregistrement…' : 'Enregistrer') | tr }}</button></div>
      </form>
    } @else {
      <div class="adm-loading"><span></span><span></span><span></span></div>
    }
  `,
})
export class SettingsPage {
  private readonly api = inject(AdminApi);
  private readonly toaster = inject(Toaster);
  private readonly content = inject(ContentService);
  private readonly i18n = inject(I18nService);
  protected readonly edit = inject(EditLang);
  protected readonly s = signal<Settings | null>(null);
  protected readonly busy = signal(false);
  protected readonly defaultBooking = DEFAULT_BOOKING_URL;

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const st = await this.api.settings();
      this.s.set({ ...st, hours: Array.isArray(st.hours) ? st.hours : [] });
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected async save(): Promise<void> {
    const st = this.s();
    if (!st) return;
    this.busy.set(true);
    try {
      const saved = await this.api.saveSettings(st);
      this.s.set({ ...saved, hours: Array.isArray(saved.hours) ? saved.hours : [] });
      this.toaster.ok(this.i18n.tr('Coordonnées enregistrées.'));
      this.content.load(true);
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
