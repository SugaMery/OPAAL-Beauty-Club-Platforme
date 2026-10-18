import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { errorMessage } from '../core/api.service';
import { ContentService } from '../core/content.service';
import { I18nService, Lang, localizePath, mark } from '../core/i18n';
import { SITE_URL } from '../core/site';
import { AuthService } from './auth';
import { MediaPicker } from './media';
import { AdminApi, Campaign, CampaignInput, Subscriber } from './admin-api';
import { AdmIconComponent, CAMPAIGN_LABELS, StatusComponent, SUBSCRIBER_LABELS, Toaster, downloadCsv, shortDate, when } from './admin-shared';
import { ADMIN_I18N, EditLang } from './admin-i18n';

interface Draft extends CampaignInput {
  id: number | null;
}

/** Champs traduisibles d'une campagne. */
type TextField = 'subject' | 'heading' | 'body' | 'button_label' | 'button_url';

const EMPTY: Draft = {
  id: null,
  subject: '',
  heading: 'Bonjour {prenom} !',
  body: '',
  button_label: 'Réserver mon soin',
  button_url: '',
  image: 'images/soin-visage-guasha.jpg',
  subject_en: '',
  heading_en: 'Hello {prenom}!',
  body_en: '',
  button_label_en: 'Book my treatment',
  button_url_en: '',
};

const EXAMPLE = `Le printemps arrive chez OPAAL Beauty Club : c'est le moment idéal pour offrir à votre peau un vrai coup d'éclat.

## L'offre du moment
- **-20 %** sur le soin éclat jusqu'au 30 avril
- Un diagnostic de peau offert

Nos créneaux partent vite : réservez dès maintenant en ligne ou sur WhatsApp.

À très bientôt,
L'équipe OPAAL`;

const EXAMPLE_EN = `Spring is coming to OPAAL Beauty Club: the perfect time to give your skin a real glow.

## Our current offer
- **20% off** the radiance facial until 30 April
- A complimentary skin consultation

Our slots fill up fast: book now online or on WhatsApp.

See you very soon,
The OPAAL team`;

@Component({
  selector: 'app-admin-newsletter',
  imports: [FormsModule, AdmIconComponent, StatusComponent, ADMIN_I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-page-head">
      <div>
        <h1>{{ 'Newsletter' | tr }}</h1>
        <p class="adm-muted">{{ 'Envoyez vos offres et nouveautés par e-mail, au design du site. Les clientes s’inscrivent depuis le pied de page du site ; vous pouvez aussi importer vos contacts.' | tr }}</p>
      </div>
      @if (tab() === 'campaigns' && !draft()) {
        <button type="button" class="adm-btn primary" (click)="editCampaign(null)"><app-adm-icon name="plus" /> {{ 'Nouvelle campagne' | tr }}</button>
      }
    </div>

    <div class="adm-tabs">
      <button type="button" [class.active]="tab() === 'campaigns'" (click)="tab.set('campaigns')">{{ 'Campagnes' | tr }} <b>{{ campaigns().length }}</b></button>
      <button type="button" [class.active]="tab() === 'subscribers'" (click)="tab.set('subscribers')">{{ 'Abonnées' | tr }} <b>{{ activeCount() }}</b></button>
    </div>

    @if (tab() === 'campaigns') {
      @if (draft(); as d) {
        <app-edit-lang note="Les abonnées anglophones (inscrites depuis le site anglais) reçoivent la version anglaise si son objet et son texte sont remplis ; sinon, la version française." />
        <div class="adm-grid-2 adm-grid-top">
          <form class="adm-card adm-form-card" (ngSubmit)="saveDraft()">
            <h2>{{ (d.id ? 'Modifier la campagne' : 'Nouvelle campagne') | tr }}</h2>
            <label>{{ 'Objet de l’e-mail' | tr }} <em>{{ '(ce que la cliente voit dans sa boîte)' | tr }}</em>
              <input data-tr name="subject" maxlength="150" [ngModel]="val(d, 'subject')" (ngModelChange)="setVal(d, 'subject', $event)"
                [placeholder]="edit.ph(d, 'subject', 'ex. -20 % sur le soin éclat ce mois-ci ✨' | tr)" />
            </label>
            <label>{{ 'Titre dans l’e-mail' | tr }} <em>({{ '{' }}prenom{{ '}' }} = {{ 'prénom de la cliente' | tr }})</em>
              <input data-tr name="heading" maxlength="150" [ngModel]="val(d, 'heading')" (ngModelChange)="setVal(d, 'heading', $event)" [placeholder]="edit.ph(d, 'heading')" />
            </label>
            <div class="adm-cover">
              @if (d.image) {<img [src]="d.image" [alt]="'Image de la campagne' | tr" />} @else {<div class="adm-cover-empty"><app-adm-icon name="image" /></div>}
              <div>
                <label>{{ 'Image principale' | tr }} <em>{{ '(affichée en haut de l’e-mail, commune aux deux langues)' | tr }}</em></label>
                <div class="adm-actions" style="margin: 0">
                  <button type="button" class="adm-btn sm primary" (click)="pickImage(d)"><app-adm-icon name="image" /> {{ (d.image ? 'Changer' : 'Choisir une image') | tr }}</button>
                  @if (d.image) {<button type="button" class="adm-btn sm" (click)="d.image = ''">{{ 'Retirer' | tr }}</button>}
                  <button type="button" class="adm-btn sm" (click)="insertImage(d)"><app-adm-icon name="plus" /> {{ 'Image dans le texte' | tr }}</button>
                </div>
              </div>
            </div>
            <label>{{ 'Texte' | tr }}
              <textarea data-tr name="body" rows="12" [ngModel]="val(d, 'body')" (ngModelChange)="setVal(d, 'body', $event)"
                [placeholder]="edit.en() ? ('Écrivez ici la version anglaise… (vide = version française pour tout le monde)' | tr) : ('Écrivez votre message…' | tr)"></textarea>
            </label>
            <p class="adm-hint">{{ 'Ligne vide = nouveau paragraphe · « ## » en début de ligne = intertitre · « - » = liste · **texte** = gras · [texte](/soins) = lien · les images sont intégrées à l’e-mail.' | tr }}
              @if (!val(d, 'body')) {<button type="button" class="adm-link-btn" (click)="setVal(d, 'body', edit.en() ? exampleEn : example)">{{ 'Insérer un exemple' | tr }}</button>}
            </p>
            <div class="adm-row2">
              <label>{{ 'Texte du bouton' | tr }} <em>{{ '(vide = pas de bouton)' | tr }}</em>
                <input data-tr name="bl" maxlength="40" [ngModel]="val(d, 'button_label')" (ngModelChange)="setVal(d, 'button_label', $event)" [placeholder]="edit.ph(d, 'button_label')" />
              </label>
              <label>{{ 'Lien du bouton' | tr }}
                <input data-tr name="bu" [ngModel]="val(d, 'button_url')" (ngModelChange)="setVal(d, 'button_url', $event)" [placeholder]="edit.en() ? (d.button_url || bookingUrl()) : bookingUrl()" />
              </label>
            </div>
            <div class="adm-chips">
              <span>{{ 'Liens rapides :' | tr }}</span>
              <button type="button" (click)="setVal(d, 'button_url', bookingUrl())">{{ 'Agenda de réservation' | tr }}</button>
              <button type="button" (click)="setVal(d, 'button_url', page('/soins'))">{{ 'Page Soins' | tr }}</button>
              <button type="button" (click)="setVal(d, 'button_url', page('/membership'))">{{ 'Club OPAAL' | tr }}</button>
            </div>
            <div class="adm-actions">
              <button class="adm-btn primary" type="submit" [disabled]="busy()">{{ 'Enregistrer le brouillon' | tr }}</button>
              <button type="button" class="adm-btn" (click)="preview()" [disabled]="busy()"><app-adm-icon name="eye" /> {{ 'Aperçu' | tr }}</button>
              <button type="button" class="adm-btn" (click)="draft.set(null); previewHtml.set(null)">{{ 'Fermer' | tr }}</button>
            </div>
            <div class="adm-side-panel">
              <h3>{{ 'Tester puis envoyer' | tr }}</h3>
              <div class="adm-inline-form">
                <input type="email" name="testTo" [(ngModel)]="testTo" [placeholder]="'Votre adresse e-mail' | tr" />
                <button type="button" class="adm-btn" (click)="sendTest()" [disabled]="busy()"><app-adm-icon name="send" /> {{ (edit.en() ? 'Envoyer un test (anglais)' : 'Envoyer un test') | tr }}</button>
              </div>
              <button type="button" class="adm-btn primary block" style="margin-top: 12px" (click)="sendFromDraft()" [disabled]="busy() || !activeCount()">
                <app-adm-icon name="send" /> {{ (activeCount() > 1 ? 'Envoyer à {n} abonnées' : 'Envoyer à {n} abonnée') | tr: { n: activeCount() } }}
              </button>
              @if (enCount()) {
                <p class="adm-hint" style="margin-top: 10px">{{ '{fr} en français · {en} en anglais' | tr: { fr: activeCount() - enCount(), en: enCount() } }}@if (!hasEn(d)) { — {{ 'version anglaise vide : toutes recevront la version française.' | tr }}}</p>
              }
            </div>
          </form>
          <section class="adm-card adm-preview-card">
            <header class="adm-card-head"><h2>{{ 'Aperçu' | tr }}@if (edit.en()) { · English}</h2>@if (previewHtml()) {<button type="button" class="adm-btn sm" (click)="preview()">{{ 'Actualiser' | tr }}</button>}</header>
            @if (previewHtml(); as html) {
              <iframe class="adm-mail-frame" [srcdoc]="html" [title]="'Aperçu de l’e-mail' | tr"></iframe>
            } @else {
              <p class="adm-empty">{{ 'Cliquez sur « Aperçu » pour voir l’e-mail tel que vos clientes le recevront.' | tr }}</p>
            }
          </section>
        </div>
      }

      @if (sending(); as s) {
        <section class="adm-card adm-progress-card" role="status">
          <h2>{{ 'Envoi en cours…' | tr }}</h2>
          <p class="adm-muted">{{ 'Gardez cette page ouverte : les e-mails partent par petits lots pour respecter les limites de votre messagerie IONOS.' | tr }}</p>
          <div class="adm-progress"><i [style.width.%]="s.total ? ((s.sent + s.failed) / s.total) * 100 : 0"></i></div>
          <p>{{ '{sent} envoyé(s) sur {total}' | tr: { sent: s.sent, total: s.total } }}@if (s.failed) { · <span class="adm-err-text">{{ '{n} échec(s)' | tr: { n: s.failed } }}</span>}</p>
          <button type="button" class="adm-btn sm" (click)="stop = true">{{ 'Mettre en pause' | tr }}</button>
        </section>
      }

      <div class="adm-campaigns">
        @for (c of campaigns(); track c.id) {
          <article class="adm-campaign">
            <div class="adm-campaign-main">
              <app-status [value]="c.status" [label]="campaignLabels[c.status]" />
              @if (c.subject_en && c.body_en) {<app-lang-badge lang="en" />}
              <h3>{{ i18n.lang() === 'en' && c.subject_en ? c.subject_en : c.subject }}</h3>
              <p class="adm-muted">
                {{ 'Créée {when}' | tr: { when: when(c.created_at) } }}@if (c.sent_at) { · {{ 'envoyée le {date}' | tr: { date: shortDate(c.sent_at) } }}}
              </p>
            </div>
            <div class="adm-campaign-stats">
              @if (c.stats.total) {
                <b>{{ c.stats.sent }}</b><span>{{ '/ {n} envoyés' | tr: { n: c.stats.total } }}</span>
                @if (c.stats.failed) {<em>{{ '{n} échec(s)' | tr: { n: c.stats.failed } }}</em>}
              } @else {
                <span>{{ 'Pas encore envoyée' | tr }}</span>
              }
            </div>
            <div class="adm-actions">
              @if (c.status === 'draft') {
                <button type="button" class="adm-btn sm" (click)="editCampaign(c)">{{ 'Modifier' | tr }}</button>
                <button type="button" class="adm-btn sm primary" (click)="send(c)" [disabled]="!!sending()">{{ 'Envoyer' | tr }}</button>
              }
              @if (c.status === 'sending') {
                <button type="button" class="adm-btn sm primary" (click)="run(c.id)" [disabled]="!!sending()">{{ 'Reprendre l’envoi' | tr }}</button>
              }
              @if (c.status === 'sent' && c.stats.failed) {
                <button type="button" class="adm-btn sm" (click)="retry(c)" [disabled]="!!sending()">{{ 'Réessayer les échecs' | tr }}</button>
              }
              <button type="button" class="adm-btn sm" (click)="duplicate(c)"><app-adm-icon name="copy" /> {{ 'Dupliquer' | tr }}</button>
              <button type="button" class="adm-icon-btn" [attr.aria-label]="'Supprimer' | tr" (click)="removeCampaign(c)"><app-adm-icon name="trash" /></button>
            </div>
          </article>
        } @empty {
          @if (!draft()) {<p class="adm-empty">{{ 'Aucune campagne pour le moment. Cliquez sur « Nouvelle campagne » pour écrire votre première newsletter.' | tr }}</p>}
        }
      </div>
    } @else {
      <div class="adm-grid-2 adm-grid-top">
        <section class="adm-card">
          <h2>{{ 'Ajouter des abonnées' | tr }}</h2>
          <p class="adm-muted">{{ 'Collez une ou plusieurs adresses (une par ligne). Formats acceptés : « email », « email;prénom » ou « {example} » — un copier-coller depuis Excel fonctionne aussi.' | tr: { example: nameEmail() } }}</p>
          <textarea rows="5" [(ngModel)]="importText" placeholder="sarah@exemple.com;Sarah&#10;leila@exemple.com"></textarea>
          <label class="adm-inline-label">{{ 'Langue des e-mails pour ces adresses' | tr }}
            <select [(ngModel)]="importLang">
              <option value="fr">{{ 'Français' | tr }}</option>
              <option value="en">{{ 'Anglais' | tr }}</option>
            </select>
          </label>
          <p class="adm-hint">{{ 'N’ajoutez que des clientes qui ont accepté de recevoir vos e-mails (loi 09-08). Chaque e-mail contient un lien de désinscription.' | tr }}</p>
          <button type="button" class="adm-btn primary" (click)="importList()" [disabled]="busy() || !importText.trim()"><app-adm-icon name="plus" /> {{ 'Ajouter' | tr }}</button>
        </section>
        <section class="adm-card">
          <h2>{{ 'En chiffres' | tr }}</h2>
          <div class="adm-mini-stats">
            <div><b>{{ activeCount() }}</b><span>{{ 'abonnées actives' | tr }}</span></div>
            <div><b>{{ fromSite() }}</b><span>{{ 'inscrites via le site' | tr }}</span></div>
            <div><b>{{ enCount() }}</b><span>{{ 'en anglais' | tr }}</span></div>
            <div><b>{{ unsubCount() }}</b><span>{{ 'désinscrites' | tr }}</span></div>
          </div>
          <button type="button" class="adm-btn" (click)="exportCsv()" [disabled]="!subscribers().length"><app-adm-icon name="download" /> {{ 'Exporter (Excel / CSV)' | tr }}</button>
        </section>
      </div>

      <div class="adm-toolbar">
        <input class="adm-search" type="search" [placeholder]="'Rechercher un e-mail ou un prénom…' | tr" [ngModel]="search()" (ngModelChange)="search.set($event)" />
        <div class="adm-tabs">
          @for (f of filters; track f.key) {
            <button type="button" [class.active]="filter() === f.key" (click)="filter.set(f.key)">{{ f.label | tr }}</button>
          }
        </div>
      </div>
      <div class="adm-subs">
        @for (s of filtered(); track s.id) {
          <div class="adm-sub" [class.off]="s.status !== 'active'">
            <div><strong>{{ s.email }}</strong><span>{{ s.name || '—' }} · {{ s.source === 'site' ? ('inscrite via le site' | tr) : (s.source | tr) }} · {{ when(s.created_at) }}</span></div>
            <select class="adm-lang-select" [ngModel]="s.lang || 'fr'" (ngModelChange)="setSubLang(s, $event)" [attr.aria-label]="'Langue des e-mails' | tr">
              <option value="fr">FR</option>
              <option value="en">EN</option>
            </select>
            <app-status [value]="s.status === 'active' ? 'approved' : 'lu'" [label]="subLabels[s.status]" />
            <div class="adm-row-actions">
              <button type="button" class="adm-btn sm" (click)="toggleSub(s)">{{ (s.status === 'active' ? 'Désinscrire' : 'Réabonner') | tr }}</button>
              <button type="button" class="adm-icon-btn" [attr.aria-label]="'Supprimer' | tr" (click)="removeSub(s)"><app-adm-icon name="trash" /></button>
            </div>
          </div>
        } @empty {
          <p class="adm-empty">{{ 'Aucune abonnée dans cette liste.' | tr }}</p>
        }
      </div>
    }
  `,
})
export class NewsletterPage {
  private readonly api = inject(AdminApi);
  private readonly toaster = inject(Toaster);
  private readonly content = inject(ContentService);
  private readonly auth = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly picker = inject(MediaPicker);
  protected readonly i18n = inject(I18nService);
  protected readonly edit = inject(EditLang);
  protected readonly campaignLabels = CAMPAIGN_LABELS;
  protected readonly subLabels = SUBSCRIBER_LABELS;
  protected readonly when = when;
  protected readonly shortDate = shortDate;
  protected readonly example = EXAMPLE;
  protected readonly exampleEn = EXAMPLE_EN;

  protected readonly tab = signal<'campaigns' | 'subscribers'>('campaigns');
  protected readonly campaigns = signal<Campaign[]>([]);
  protected readonly subscribers = signal<Subscriber[]>([]);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly previewHtml = signal<SafeHtml | null>(null);
  protected readonly busy = signal(false);
  protected readonly sending = signal<{ total: number; sent: number; failed: number } | null>(null);
  protected readonly search = signal('');
  protected readonly filter = signal<'all' | 'active' | 'unsubscribed'>('active');
  /** Exemple de format « Prénom <email> » (hors du modèle HTML). */
  protected nameEmail(): string {
    return this.i18n.lang() === 'en' ? 'Name <email>' : 'Prénom <email>';
  }
  /** Origine « ajout manuel » (import) : traduite à l'affichage. */
  protected readonly manualSource = mark('ajout manuel');
  protected readonly filters = [
    { key: 'active' as const, label: mark('Abonnées') },
    { key: 'unsubscribed' as const, label: mark('Désinscrites') },
    { key: 'all' as const, label: mark('Toutes') },
  ];
  protected testTo = '';
  protected importText = '';
  protected importLang: Lang = 'fr';
  protected stop = false;
  private destroyed = false;

  protected readonly bookingUrl = computed(() => this.content.settings().booking_url || 'https://dikidi.net/1891924');
  protected readonly activeCount = computed(() => this.subscribers().filter((s) => s.status === 'active').length);
  protected readonly enCount = computed(() => this.subscribers().filter((s) => s.status === 'active' && s.lang === 'en').length);
  protected readonly unsubCount = computed(() => this.subscribers().filter((s) => s.status !== 'active').length);
  protected readonly fromSite = computed(() => this.subscribers().filter((s) => s.source === 'site' && s.status === 'active').length);
  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const f = this.filter();
    return this.subscribers().filter(
      (s) => (f === 'all' || s.status === f) && (!q || s.email.includes(q) || s.name.toLowerCase().includes(q)),
    );
  });

  constructor() {
    this.testTo = this.auth.email();
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [c, s] = await Promise.all([this.api.campaigns(), this.api.subscribers()]);
      this.campaigns.set(c);
      this.subscribers.set(s);
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  /* ---------- Campagnes ---------- */

  protected val(d: Draft, f: TextField): string {
    return this.edit.get(d, f);
  }

  protected setVal(d: Draft, f: TextField, v: string): void {
    this.edit.set_(d, f, v);
    this.draft.set({ ...d });
  }

  protected hasEn(d: Draft): boolean {
    return !!d.subject_en.trim() && !!d.body_en.trim();
  }

  /** Adresse d'une page du site dans la langue modifiée. */
  protected page(path: string): string {
    return SITE_URL + localizePath(path, this.edit.lang());
  }

  private fromCampaign(c: Campaign): Omit<Draft, 'id'> {
    return {
      subject: c.subject, heading: c.heading, body: c.body, button_label: c.button_label, button_url: c.button_url, image: c.image,
      subject_en: c.subject_en ?? '', heading_en: c.heading_en ?? '', body_en: c.body_en ?? '', button_label_en: c.button_label_en ?? '',
      button_url_en: c.button_url_en ?? '',
    };
  }

  protected editCampaign(c: Campaign | null): void {
    this.previewHtml.set(null);
    this.draft.set(c ? { id: c.id, ...this.fromCampaign(c) } : { ...EMPTY, button_url: this.bookingUrl() });
    setTimeout(() => document.querySelector('.adm-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  protected duplicate(c: Campaign): void {
    this.editCampaign(null);
    this.draft.set({ id: null, ...this.fromCampaign(c) });
  }

  protected async pickImage(d: Draft): Promise<void> {
    const img = await this.picker.open(this.i18n.tr('Image principale de l’e-mail'));
    if (img) {
      d.image = img.src;
      this.draft.set({ ...d });
    }
  }

  protected async insertImage(d: Draft): Promise<void> {
    const img = await this.picker.open(this.i18n.tr('Insérer une image dans le texte'));
    if (img) {
      const body = this.val(d, 'body');
      this.setVal(d, 'body', (body.trimEnd() + `\n\n![${(img.alt || 'Photo OPAAL').replace(/[\[\]]/g, '')}](${img.src})\n\n`).trimStart());
    }
  }

  private input(d: Draft): CampaignInput {
    return {
      subject: d.subject, heading: d.heading, body: d.body, button_label: d.button_label, button_url: d.button_url, image: d.image,
      subject_en: d.subject_en, heading_en: d.heading_en, body_en: d.body_en, button_label_en: d.button_label_en, button_url_en: d.button_url_en,
    };
  }

  /** Enregistre le brouillon et renvoie la campagne (ou null en cas d'erreur). */
  private async persist(silent = false): Promise<Campaign | null> {
    const d = this.draft();
    if (!d) return null;
    if (!d.subject.trim() || !d.body.trim()) {
      this.edit.set('fr');
      this.toaster.error(this.i18n.tr('Indiquez d’abord l’objet et le texte en français.'));
      return null;
    }
    this.busy.set(true);
    try {
      const saved = d.id ? await this.api.updateCampaign(d.id, this.input(d)) : await this.api.createCampaign(this.input(d));
      d.id = saved.id;
      this.campaigns.set(await this.api.campaigns());
      if (!silent) this.toaster.ok(this.i18n.tr('Brouillon enregistré.'));
      return saved;
    } catch (e) {
      this.toaster.error(errorMessage(e));
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  protected async saveDraft(): Promise<void> {
    await this.persist();
  }

  protected async preview(): Promise<void> {
    const d = this.draft();
    if (!d) return;
    try {
      const r = await this.api.previewCampaign(this.input(d), this.edit.lang());
      this.previewHtml.set(this.sanitizer.bypassSecurityTrustHtml(r.html));
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected async sendTest(): Promise<void> {
    if (!this.testTo.trim()) {
      this.toaster.error(this.i18n.tr('Indiquez l’adresse qui doit recevoir le test.'));
      return;
    }
    const lang = this.edit.lang();
    const c = await this.persist(true);
    if (!c) return;
    this.busy.set(true);
    try {
      const r = await this.api.testCampaign(c.id, this.testTo.trim(), lang);
      if (r.ok) this.toaster.ok(this.i18n.tr('Test envoyé à {email}.', { email: this.testTo.trim() }));
      else this.toaster.error(this.i18n.tr('Échec du test : {error}', { error: r.error }));
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async sendFromDraft(): Promise<void> {
    const c = await this.persist(true);
    if (c) await this.send(c);
  }

  protected async send(c: Campaign): Promise<void> {
    const n = this.activeCount();
    const q = this.i18n.tr(n > 1 ? 'Envoyer « {subject} » à {n} abonnées ?' : 'Envoyer « {subject} » à {n} abonnée ?', { subject: c.subject, n })
      + '\n\n' + this.i18n.tr('Conseil : envoyez-vous d’abord un test.');
    if (!confirm(q)) return;
    this.draft.set(null);
    this.previewHtml.set(null);
    await this.run(c.id);
  }

  /** Envoie les lots un par un jusqu'à la fin (ou la pause). */
  protected async run(id: number): Promise<void> {
    this.stop = false;
    this.sending.set({ total: 0, sent: 0, failed: 0 });
    try {
      for (;;) {
        const r = await this.api.sendCampaignBatch(id);
        this.sending.set({ total: r.total, sent: r.sent, failed: r.failed });
        if (r.done) {
          if (r.failed) this.toaster.error(this.i18n.tr('Envoi terminé : {sent} envoyé(s), {failed} échec(s). {error}', { sent: r.sent, failed: r.failed, error: r.last_error }));
          else this.toaster.ok(this.i18n.tr(r.sent > 1 ? 'Newsletter envoyée à {n} abonnées.' : 'Newsletter envoyée à {n} abonnée.', { n: r.sent }));
          break;
        }
        if (this.stop || this.destroyed) {
          this.toaster.ok(this.i18n.tr('Envoi mis en pause : cliquez sur « Reprendre l’envoi » pour continuer.'));
          break;
        }
        await new Promise((res) => setTimeout(res, 800));
      }
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.sending.set(null);
      if (!this.destroyed) this.campaigns.set(await this.api.campaigns().catch(() => this.campaigns()));
    }
  }

  protected async retry(c: Campaign): Promise<void> {
    try {
      await this.api.retryCampaign(c.id);
      await this.run(c.id);
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected async removeCampaign(c: Campaign): Promise<void> {
    if (!confirm(this.i18n.tr('Supprimer la campagne « {subject} » ?', { subject: c.subject }))) return;
    try {
      await this.api.deleteCampaign(c.id);
      if (this.draft()?.id === c.id) this.draft.set(null);
      this.campaigns.update((l) => l.filter((x) => x.id !== c.id));
      this.toaster.ok(this.i18n.tr('Campagne supprimée.'));
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  /* ---------- Abonnées ---------- */

  protected async importList(): Promise<void> {
    this.busy.set(true);
    try {
      const r = await this.api.importSubscribers(this.importText, this.importLang);
      const t = (fr1: string, frN: string, n: number) => this.i18n.tr(n > 1 ? frN : fr1, { n });
      const parts = [t('{n} ajoutée', '{n} ajoutées', r.added)];
      if (r.existing) parts.push(t('{n} déjà présente', '{n} déjà présentes', r.existing));
      if (r.invalid.length) parts.push(t('{n} invalide', '{n} invalides', r.invalid.length) + ' : ' + r.invalid.slice(0, 3).join(', '));
      (r.invalid.length ? this.toaster.error.bind(this.toaster) : this.toaster.ok.bind(this.toaster))(parts.join(' · '));
      this.importText = r.invalid.join('\n');
      this.subscribers.set(await this.api.subscribers());
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async setSubLang(s: Subscriber, lang: string): Promise<void> {
    try {
      await this.api.updateSubscriber(s.id, { lang });
      this.subscribers.update((l) => l.map((x) => (x.id === s.id ? { ...x, lang } : x)));
      this.toaster.ok(this.i18n.tr(lang === 'en' ? '{email} recevra les e-mails en anglais.' : '{email} recevra les e-mails en français.', { email: s.email }));
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected async toggleSub(s: Subscriber): Promise<void> {
    const status = s.status === 'active' ? 'unsubscribed' : 'active';
    try {
      await this.api.updateSubscriber(s.id, { status });
      this.subscribers.update((l) => l.map((x) => (x.id === s.id ? { ...x, status } : x)));
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected async removeSub(s: Subscriber): Promise<void> {
    if (!confirm(this.i18n.tr('Supprimer définitivement {email} ?', { email: s.email }))) return;
    try {
      await this.api.deleteSubscriber(s.id);
      this.subscribers.update((l) => l.filter((x) => x.id !== s.id));
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected exportCsv(): void {
    const tr = (s: string) => this.i18n.tr(s);
    downloadCsv(`${this.i18n.lang() === 'en' ? 'opaal-subscribers' : 'abonnees-opaal'}-${new Date().toISOString().slice(0, 10)}.csv`, [
      [tr('E-mail'), tr('Prénom'), tr('Statut'), tr('Langue'), tr('Origine'), tr('Inscrite le')],
      ...this.subscribers().map((s) => [s.email, s.name, tr(SUBSCRIBER_LABELS[s.status]), (s.lang || 'fr').toUpperCase(), s.source, s.created_at]),
    ]);
  }
}
