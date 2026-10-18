import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../core/api.service';
import { ContentService } from '../core/content.service';
import { whatsappHref } from '../core/format';
import { REVIEW_SOURCES } from '../core/models';
import { SITE_URL } from '../core/site';
import { AdminApi, AdminReview, ReviewStatus } from './admin-api';
import { AdmIconComponent, REVIEW_LABELS, StatusComponent, Toaster, when } from './admin-shared';
import { ADMIN_I18N } from './admin-i18n';
import { I18nService, Lang, localizePath, mark, translate } from '../core/i18n';

interface Draft {
  id: number | null;
  name: string;
  service: string;
  rating: number;
  text: string;
  source: string;
  date: string;
  publish: boolean;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const emptyDraft = (): Draft => ({ id: null, name: '', service: '', rating: 5, text: '', source: 'google', date: today(), publish: true });

@Component({
  selector: 'app-admin-reviews',
  imports: [FormsModule, RouterLink, AdmIconComponent, StatusComponent, ADMIN_I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <datalist id="adm-services">
      @for (s of serviceNames(); track s) {<option [value]="s"></option>}
    </datalist>
    <div class="adm-page-head">
      <div>
        <h1>{{ 'Avis clientes' | tr }}</h1>
        <p class="adm-muted">
          {{ 'Envoyez le lien « Donner mon avis » à vos clientes après leur soin. Les avis laissés sur le site n’apparaissent qu’après votre validation.' | tr }}
          @if (published().length) { {{ 'Note moyenne :' | tr }} <b>{{ average() }} / 5</b> {{ 'sur {n} avis publiés.' | tr: { n: published().length } }} }
        </p>
      </div>
      <div class="adm-actions" style="margin: 0">
        <button type="button" class="adm-btn" [class.primary]="panel() === 'request'" (click)="toggle('request')"><app-adm-icon name="send" /> {{ 'Demander un avis' | tr }}</button>
        <button type="button" class="adm-btn" [class.primary]="panel() === 'add'" (click)="toggle('add')"><app-adm-icon name="plus" /> {{ 'Ajouter un avis' | tr }}</button>
      </div>
    </div>

    @if (panel() === 'request') {
      <div class="adm-grid-2 adm-grid-top adm-form-card">
        <section class="adm-card">
          <h2>{{ 'Demander un avis à une cliente' | tr }}</h2>
          <p class="adm-muted">{{ 'Renseignez ce que vous voulez : le lien pré-remplit le prénom et le soin sur la page d’avis.' | tr }}</p>
          <div class="adm-row2">
            <label>{{ 'Prénom de la cliente' | tr }}<input name="rqName" [(ngModel)]="rq.name" (ngModelChange)="bump()" [placeholder]="'ex. Sarah' | tr" /></label>
            <label>{{ 'Soin reçu' | tr }}
              <input name="rqService" list="adm-services" [(ngModel)]="rq.service" (ngModelChange)="bump()" [placeholder]="'ex. Soin éclat' | tr" />
            </label>
            <label>{{ 'WhatsApp / téléphone' | tr }} <em>{{ '(optionnel)' | tr }}</em><input name="rqPhone" type="tel" [(ngModel)]="rq.phone" (ngModelChange)="bump()" placeholder="06 12 34 56 78" /></label>
            <label>{{ 'E-mail' | tr }} <em>{{ '(optionnel)' | tr }}</em><input name="rqEmail" type="email" [(ngModel)]="rq.email" (ngModelChange)="bump()" [placeholder]="'cliente@exemple.com' | tr" /></label>
            <label>{{ 'Langue de la cliente' | tr }}
              <select name="rqLang" [(ngModel)]="rq.lang" (ngModelChange)="messageEdited = false; bump(); makeQr()">
                <option value="fr">{{ 'Français' | tr }}</option>
                <option value="en">{{ 'Anglais' | tr }}</option>
              </select>
            </label>
          </div>
          @if (rq.lang === 'en' && !content.englishEnabled()) {
            <p class="adm-hint">{{ 'La version anglaise du site est désactivée : le lien mènera à la page française.' | tr }} <a routerLink="/admin/langues">{{ 'Activer l’anglais' | tr }}</a></p>
          }

          <label>{{ 'Lien à envoyer' | tr }}
            <span class="adm-copy-row">
              <input readonly [value]="link()" (focus)="$any($event.target).select()" />
              <button type="button" class="adm-btn" (click)="copy(link(), 'Lien copié.')"><app-adm-icon name="copy" /> {{ 'Copier' | tr }}</button>
            </span>
          </label>
          <label>{{ 'Message' | tr }}
            <textarea rows="4" name="rqMsg" [(ngModel)]="message" (ngModelChange)="messageEdited = true"></textarea>
          </label>
          <div class="adm-actions" style="margin-top: 0">
            <a class="adm-btn primary" [href]="waLink()" target="_blank" rel="noopener"><app-adm-icon name="chat" /> {{ 'Envoyer sur WhatsApp' | tr }}</a>
            <button type="button" class="adm-btn" (click)="sendEmail()" [disabled]="sending() || !rq.email.trim()"><app-adm-icon name="mail" /> {{ (sending() ? 'Envoi…' : 'Envoyer par e-mail') | tr }}</button>
            @if (rq.phone.trim()) {<a class="adm-btn" [href]="smsLink()"><app-adm-icon name="phone" /> SMS</a>}
            <button type="button" class="adm-btn" (click)="copy(message, 'Message copié : collez-le où vous voulez.')"><app-adm-icon name="copy" /> {{ 'Copier le message' | tr }}</button>
          </div>
          <p class="adm-hint" style="margin-top: 12px">{{ 'Sans numéro, WhatsApp vous laisse choisir la conversation. L’e-mail est envoyé au design du site avec un bouton « Donner mon avis », dans la langue choisie.' | tr }}</p>
        </section>

        <section class="adm-card adm-qr-card">
          <h2>{{ 'QR code pour le salon' | tr }}</h2>
          <p class="adm-muted">{{ 'À imprimer et poser à l’accueil ou à glisser dans vos cartes : vos clientes le scannent avec leur téléphone.' | tr }}</p>
          @if (qr()) {
            <img class="adm-qr" [src]="qr()" [alt]="'QR code vers la page d’avis OPAAL' | tr" width="220" height="220" />
            <p class="adm-qr-url">{{ baseLink() }}</p>
            <a class="adm-btn" [href]="qr()" [attr.download]="rq.lang === 'en' ? 'qr-code-reviews-opaal.png' : 'qr-code-avis-opaal.png'"><app-adm-icon name="download" /> {{ 'Télécharger le QR code' | tr }}</a>
          } @else {
            <div class="adm-loading"><span></span><span></span><span></span></div>
          }
          <div class="adm-google">
            <h3>{{ 'Avis Google' | tr }}</h3>
            @if (google()) {
              <p class="adm-muted">{{ 'Après un avis 4 ou 5 ★ sur le site, la cliente est invitée à le publier aussi sur Google.' | tr }}</p>
              <button type="button" class="adm-btn sm" (click)="copy(google(), 'Lien Google copié.')"><app-adm-icon name="copy" /> {{ 'Copier le lien avis Google' | tr }}</button>
            } @else {
              <p class="adm-muted">{{ 'Ajoutez le lien « Laisser un avis » de votre fiche Google : après un bon avis sur le site, vos clientes seront invitées à le publier aussi sur Google.' | tr }}</p>
              <a class="adm-btn sm" routerLink="/admin/coordonnees" fragment="avis-google">{{ 'Ajouter le lien Google' | tr }}</a>
            }
          </div>
        </section>
      </div>
    }

    @if (panel() === 'add' || draft().id) { @if (draft(); as d) {
      <form class="adm-card adm-form-card" (ngSubmit)="save(false)">
        <h2>{{ (d.id ? 'Modifier l’avis' : 'Ajouter un avis reçu ailleurs') | tr }}</h2>
        @if (!d.id) {<p class="adm-muted">{{ 'Recopiez un avis reçu sur Google, Instagram, WhatsApp… avec sa date d’origine. N’ajoutez que de vrais avis de clientes.' | tr }}</p>}
        <div class="adm-row3">
          <label>{{ 'Prénom' | tr }}<input name="name" [(ngModel)]="d.name" required /></label>
          <label>{{ 'Soin' | tr }}<input name="service" list="adm-services" [(ngModel)]="d.service" [placeholder]="'ex. Soins visage' | tr" /></label>
          <label>{{ 'Note' | tr }}
            <select name="rating" [(ngModel)]="d.rating">
              @for (n of [5, 4, 3, 2, 1]; track n) {<option [ngValue]="n">{{ '★'.repeat(n) }}</option>}
            </select>
          </label>
          <label>{{ 'Origine' | tr }}
            <select name="source" [(ngModel)]="d.source">
              @for (s of sourceKeys; track s) {<option [value]="s">{{ sources[s] | tr }}</option>}
            </select>
          </label>
          <label>{{ 'Date de l’avis' | tr }}<input name="date" type="date" [max]="maxDate" [(ngModel)]="d.date" /></label>
        </div>
        <label>{{ 'Avis' | tr }} <em>({{ d.text.length }}/1500)</em><textarea class="autogrow" name="text" rows="3" maxlength="1500" [(ngModel)]="d.text" required></textarea></label>
        <p class="adm-hint">{{ 'Les avis sont affichés tels quels, dans leur langue d’origine, sur les deux versions du site.' | tr }}</p>
        @if (!d.id) {<label class="adm-check"><input type="checkbox" name="publish" [(ngModel)]="d.publish" /> {{ 'Publier directement sur le site' | tr }}</label>}
        <div class="adm-actions">
          <button class="adm-btn primary" type="submit" [disabled]="busy()">{{ 'Enregistrer' | tr }}</button>
          @if (!d.id) {<button type="button" class="adm-btn" (click)="save(true)" [disabled]="busy()">{{ 'Enregistrer et en ajouter un autre' | tr }}</button>}
          <button type="button" class="adm-btn" (click)="cancel()">{{ 'Annuler' | tr }}</button>
        </div>
      </form>
    } }

    <div class="adm-tabs">
      @for (t of tabs; track t.key) {
        <button type="button" [class.active]="tab() === t.key" (click)="tab.set(t.key)">{{ t.label | tr }} <b>{{ count(t.key) }}</b></button>
      }
    </div>

    @if (loading()) {
      <div class="adm-loading"><span></span><span></span><span></span></div>
    } @else if (!filtered().length) {
      <p class="adm-empty">
        {{ 'Aucun avis dans cette liste.' | tr }}
        @if (!items().length) {<br />{{ 'Cliquez sur « Demander un avis » pour envoyer le lien à vos clientes.' | tr }}}
      </p>
    } @else {
      <div class="adm-reviews">
        @for (r of filtered(); track r.id) {
          <article class="adm-review">
            <header>
              <span class="adm-stars">{{ '★'.repeat(r.rating) }}<i>{{ '★'.repeat(5 - r.rating) }}</i></span>
              <app-status [value]="r.status" [label]="labels[r.status]" />
            </header>
            <p class="adm-review-text">“{{ r.text }}”</p>
            <footer>
              <strong>{{ r.name }}</strong>{{ r.service ? ' · ' + r.service : '' }} <span>{{ when(r.created_at) }}</span>
              @if (r.lang === 'en') {<app-lang-badge lang="en" />}
              @if (r.source && r.source !== 'site') {<span class="adm-pill">{{ (sources[r.source] || r.source) | tr }}</span>}
            </footer>
            <div class="adm-actions">
              @if (r.status !== 'approved') {<button type="button" class="adm-btn primary sm" (click)="set(r, 'approved')"><app-adm-icon name="check" /> {{ 'Publier' | tr }}</button>}
              @if (r.status !== 'rejected') {<button type="button" class="adm-btn sm" (click)="set(r, 'rejected')"><app-adm-icon name="x" /> {{ (r.status === 'approved' ? 'Retirer du site' : 'Refuser') | tr }}</button>}
              <button type="button" class="adm-btn sm" (click)="edit(r)">{{ 'Modifier' | tr }}</button>
              <button type="button" class="adm-icon-btn" [attr.aria-label]="'Supprimer' | tr" (click)="remove(r)"><app-adm-icon name="trash" /></button>
            </div>
          </article>
        }
      </div>
    }
  `,
})
export class ReviewsAdminPage {
  private readonly api = inject(AdminApi);
  private readonly toaster = inject(Toaster);
  protected readonly content = inject(ContentService);
  private readonly i18n = inject(I18nService);
  protected readonly labels = REVIEW_LABELS;
  protected readonly sources = REVIEW_SOURCES;
  protected readonly sourceKeys = Object.keys(REVIEW_SOURCES);
  protected readonly when = when;
  protected readonly maxDate = today();
  /** Page d'avis dans la langue de la cliente (anglais seulement si la version anglaise est activée). */
  protected readonly baseLink = computed(() => {
    this.version();
    const lang: Lang = this.rq.lang === 'en' && this.content.englishEnabled() ? 'en' : 'fr';
    return SITE_URL + localizePath('/avis', lang);
  });
  protected readonly items = signal<AdminReview[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly sending = signal(false);
  protected readonly panel = signal<'request' | 'add' | null>(null);
  protected readonly draft = signal<Draft>(emptyDraft());
  protected readonly tab = signal<ReviewStatus>('pending');
  protected readonly qr = signal('');
  protected readonly tabs: { key: ReviewStatus; label: string }[] = [
    { key: 'pending', label: mark('À valider') },
    { key: 'approved', label: mark('Publiés') },
    { key: 'rejected', label: mark('Refusés') },
  ];
  protected readonly filtered = computed(() => this.items().filter((r) => r.status === this.tab()));
  protected readonly published = computed(() => this.items().filter((r) => r.status === 'approved'));
  protected readonly average = computed(() => {
    const p = this.published();
    return p.length ? (Math.round((p.reduce((s, r) => s + r.rating, 0) / p.length) * 10) / 10).toLocaleString(this.i18n.locale()) : '—';
  });
  protected readonly serviceNames = computed(() => this.content.categories().flatMap((c) => [c.title, ...c.services.map((s) => s.name)]));
  protected readonly google = computed(() => this.content.settings().google_review_url || '');

  /* Demande d'avis */
  protected rq = { name: '', service: '', phone: '', email: '', lang: 'fr' as Lang };
  protected message = '';
  protected messageEdited = false;
  private readonly version = signal(0);
  protected readonly link = computed(() => {
    this.version();
    return this.linkNow();
  });
  protected readonly waLink = computed(() => {
    this.version();
    const phone = this.rq.phone.trim();
    return phone ? whatsappHref({ whatsapp: phone, phone }, this.message) : 'https://wa.me/?text=' + encodeURIComponent(this.message);
  });
  protected readonly smsLink = computed(() => {
    this.version();
    return `sms:${this.rq.phone.replace(/[^\d+]/g, '')}?body=${encodeURIComponent(this.message)}`;
  });

  constructor() {
    void this.load().then(() => {
      if (!this.count('pending')) this.tab.set('approved');
      if (!this.items().length) this.toggle('request');
    });
    this.bump();
  }

  protected count(k: ReviewStatus): number {
    return this.items().filter((r) => r.status === k).length;
  }

  private async load(): Promise<void> {
    try {
      this.items.set(await this.api.reviews());
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected toggle(p: 'request' | 'add'): void {
    this.draft.set(emptyDraft());
    this.panel.set(this.panel() === p ? null : p);
    if (this.panel() === 'request' && !this.qr()) void this.makeQr();
  }

  /** Met à jour le lien et le message après une saisie. */
  protected bump(): void {
    this.version.update((v) => v + 1);
    if (!this.messageEdited) {
      // Message dans la langue de la cliente
      const first = this.rq.name.trim();
      const l = this.rq.lang;
      this.message =
        (first ? translate(l, 'Bonjour {name}, merci pour votre visite chez OPAAL Beauty Club ✨', { name: first }) : translate(l, 'Bonjour, merci pour votre visite chez OPAAL Beauty Club ✨')) + '\n' +
        translate(l, 'Votre avis compte beaucoup pour nous : pourriez-vous prendre une minute pour le partager ?') + '\n' +
        this.linkNow();
    }
  }

  private linkNow(): string {
    const p = new URLSearchParams();
    if (this.rq.name.trim()) p.set('prenom', this.rq.name.trim());
    if (this.rq.service.trim()) p.set('soin', this.rq.service.trim());
    const q = p.toString();
    return this.baseLink() + (q ? '?' + q : '');
  }

  protected async makeQr(): Promise<void> {
    try {
      const mod = (await import('qrcode-generator')) as unknown as { default?: QrFactory } & QrFactory;
      const factory: QrFactory = mod.default ?? mod;
      const qr = factory(0, 'M');
      qr.addData(this.baseLink());
      qr.make();
      const cell = 12;
      const margin = 4;
      const size = (qr.getModuleCount() + margin * 2) * cell;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#121212';
      for (let r = 0; r < qr.getModuleCount(); r++) {
        for (let c = 0; c < qr.getModuleCount(); c++) {
          if (qr.isDark(r, c)) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
        }
      }
      this.qr.set(canvas.toDataURL('image/png'));
    } catch (e) {
      this.toaster.error(this.i18n.tr('QR code indisponible : {error}', { error: errorMessage(e) }));
    }
  }

  protected async copy(text: string, ok: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toaster.ok(this.i18n.tr(ok));
    } catch {
      this.toaster.error(this.i18n.tr('Copie impossible : sélectionnez le texte et copiez-le (Ctrl+C).'));
    }
  }

  protected async sendEmail(): Promise<void> {
    this.sending.set(true);
    try {
      const lang = this.rq.lang === 'en' && this.content.englishEnabled() ? 'en' : 'fr';
      const r = await this.api.requestReview({ email: this.rq.email.trim(), name: this.rq.name.trim(), service: this.rq.service.trim(), lang });
      if (r.ok) {
        this.toaster.ok(this.i18n.tr('Demande d’avis envoyée à {email}.', { email: this.rq.email.trim() }));
        this.rq = { name: '', service: '', phone: '', email: '', lang: this.rq.lang };
        this.messageEdited = false;
        this.bump();
      } else {
        this.toaster.error(this.i18n.tr('Échec de l’envoi : {error}', { error: r.error }));
      }
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.sending.set(false);
    }
  }

  /* Ajout / modification */

  protected edit(r: AdminReview): void {
    this.panel.set(null);
    this.draft.set({
      id: r.id, name: r.name, service: r.service, rating: r.rating, text: r.text,
      source: r.source || 'site', date: r.created_at.slice(0, 10), publish: r.status === 'approved',
    });
    setTimeout(() => document.querySelector('.adm-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  protected cancel(): void {
    this.draft.set(emptyDraft());
    this.panel.set(null);
  }

  protected async save(another: boolean): Promise<void> {
    const d = this.draft();
    this.busy.set(true);
    try {
      const body = { name: d.name, service: d.service, rating: d.rating, text: d.text, source: d.source, date: d.date };
      if (d.id) {
        await this.api.updateReview(d.id, body);
        this.toaster.ok(this.i18n.tr('Avis modifié.'));
      } else {
        await this.api.addReview({ ...body, status: d.publish ? 'approved' : 'pending' });
        this.toaster.ok(this.i18n.tr(d.publish ? 'Avis ajouté et publié.' : 'Avis ajouté (à valider).'));
      }
      const keep = another ? { source: d.source, publish: d.publish } : null;
      this.draft.set({ ...emptyDraft(), ...(keep ?? {}) });
      if (!another) this.panel.set(null);
      await this.load();
      this.content.load(true);
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async set(r: AdminReview, status: ReviewStatus): Promise<void> {
    try {
      await this.api.updateReview(r.id, { status });
      this.items.update((l) => l.map((x) => (x.id === r.id ? { ...x, status } : x)));
      this.toaster.ok(this.i18n.tr(status === 'approved' ? 'Avis publié sur le site.' : 'Avis retiré du site.'));
      this.content.load(true);
      void this.api.refreshBadges();
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected async remove(r: AdminReview): Promise<void> {
    if (!confirm(this.i18n.tr('Supprimer l’avis de {name} ?', { name: r.name }))) return;
    try {
      await this.api.deleteReview(r.id);
      this.items.update((l) => l.filter((x) => x.id !== r.id));
      this.toaster.ok(this.i18n.tr('Avis supprimé.'));
      this.content.load(true);
      void this.api.refreshBadges();
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }
}

type QrFactory = (typeNumber: 0, level: 'L' | 'M' | 'Q' | 'H') => {
  addData(data: string): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
};
