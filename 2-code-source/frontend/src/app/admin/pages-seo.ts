import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorMessage } from '../core/api.service';
import { ContentService } from '../core/content.service';
import { DEFAULT_LEGAL, DEFAULT_LEGAL_EN } from '../core/legal-default';
import { LegalSection, PageSeo } from '../core/models';
import { PAGE_SEO, pageSeoDefaults } from '../core/page-seo';
import { I18nService, Lang, localizePath, mark } from '../core/i18n';
import { AdminApi, SeoState } from './admin-api';
import { AdmIconComponent, Toaster } from './admin-shared';
import { MediaPicker } from './media';
import { ADMIN_I18N, EditLang } from './admin-i18n';

interface PageRow {
  path: string;
  label: string;
  title: string;
  description: string;
  image: string;
  defTitle: string;
  defDescription: string;
  defImage: string;
}

const FILE_LABELS: Record<string, string> = {
  ok: mark('En ligne à jour'),
  updated: mark('Mis à jour'),
  absent: mark('Page non publiée ici'),
  readonly: mark('Fichier non modifiable'),
};

@Component({
  selector: 'app-admin-pages-seo',
  imports: [FormsModule, AdmIconComponent, ADMIN_I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-page-head">
      <div>
        <h1>{{ 'Pages & SEO' | tr }}</h1>
        <p class="adm-muted">{{ 'Choisissez comment chaque page apparaît dans Google et lors d’un partage (WhatsApp, Facebook, Instagram), et modifiez vos mentions légales et conditions.' | tr }}</p>
      </div>
    </div>

    <app-edit-lang note="Chaque page existe en français (/soins) et en anglais (/en/soins) : leurs titres Google se règlent séparément." />

    <div class="adm-tabs">
      <button type="button" [class.active]="tab() === 'seo'" (click)="tab.set('seo')"><app-adm-icon name="search" /> {{ 'Référencement (Google)' | tr }}</button>
      <button type="button" [class.active]="tab() === 'legal'" (click)="tab.set('legal')"><app-adm-icon name="doc" /> {{ 'Mentions & conditions' | tr }}</button>
    </div>

    @if (tab() === 'seo') {
      <div class="adm-card adm-tip">
        <b>{{ 'Conseils :' | tr }}</b> {{ 'un titre de 50 à 60 caractères avec le soin et la ville (ex. « Soin visage à Marrakech »), une description de 120 à 160 caractères qui donne envie de cliquer.' | tr }}
        {{ 'Laissez un champ vide pour garder le texte d’origine.' | tr }}
      </div>
      @if (rows().length) {
        <form (ngSubmit)="saveSeo()">
          @for (r of rows(); track r.path) {
            <section class="adm-card adm-seo">
              <header class="adm-card-head">
                <h2>{{ r.label | tr }} <a class="adm-seo-path" [href]="url(r.path)" target="_blank" rel="noopener">{{ url(r.path) }}</a></h2>
                @if (files()[url(r.path)]; as f) {<span class="adm-pill" [class.ok]="f === 'ok' || f === 'updated'" [attr.title]="fileHelp(f)">{{ fileLabels[f] | tr }}</span>}
              </header>
              <div class="adm-seo-grid">
                <div>
                  <label>{{ 'Titre' | tr }} <em [class.warn]="len(r.title || r.defTitle) > 60">{{ len(r.title || r.defTitle) }}/60</em>
                    <input data-tr [name]="'t' + r.path" [(ngModel)]="r.title" [placeholder]="r.defTitle" maxlength="120" />
                  </label>
                  <label>{{ 'Description' | tr }} <em [class.warn]="len(r.description || r.defDescription) > 160">{{ len(r.description || r.defDescription) }}/160</em>
                    <textarea data-tr [name]="'d' + r.path" rows="3" [(ngModel)]="r.description" [placeholder]="r.defDescription" maxlength="320"></textarea>
                  </label>
                  <label>{{ 'Image de partage' | tr }} <em>{{ '(WhatsApp, Facebook, Instagram — idéal 1200 × 630)' | tr }}</em></label>
                  <div class="adm-actions" style="margin: 0 0 8px">
                    <button type="button" class="adm-btn sm" (click)="pickImage(r)"><app-adm-icon name="image" /> {{ 'Changer l’image' | tr }}</button>
                    @if (r.image) {<button type="button" class="adm-btn sm" (click)="r.image = ''">{{ 'Image d’origine' | tr }}</button>}
                  </div>
                  @if (r.title || r.description || r.image) {
                    <button type="button" class="adm-link-btn" (click)="r.title = ''; r.description = ''; r.image = ''">{{ 'Tout remettre d’origine' | tr }}</button>
                  }
                </div>
                <div>
                  <div class="adm-serp" [attr.aria-label]="'Aperçu dans Google' | tr">
                    <small>{{ 'Aperçu Google' | tr }}</small>
                    <span class="u">opaalbeautyclub.com{{ url(r.path) === '/' ? '' : ' › ' + url(r.path).slice(1).replaceAll('/', ' › ') }}</span>
                    <b>{{ cut(r.title || r.defTitle, 60) }}</b>
                    <p>{{ cut(r.description || r.defDescription, 160) }}</p>
                  </div>
                  <div class="adm-share" [attr.aria-label]="'Aperçu d’un partage' | tr">
                    <small>{{ 'Aperçu d’un partage (WhatsApp, Facebook)' | tr }}</small>
                    <div class="adm-share-card">
                      <img [src]="r.image || r.defImage" alt="" loading="lazy" />
                      <div><span>OPAALBEAUTY.COM</span><b>{{ cut(r.title || r.defTitle, 70) }}</b><p>{{ cut(r.description || r.defDescription, 110) }}</p></div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          }
          <div class="adm-sticky-save"><button class="adm-btn primary" type="submit" [disabled]="busy()">{{ (busy() ? 'Enregistrement…' : 'Enregistrer le référencement') | tr }}</button></div>
        </form>
      } @else {
        <div class="adm-loading"><span></span><span></span><span></span></div>
      }
    } @else {
      <div class="adm-card adm-tip">
        {{ 'Mots-clés remplacés automatiquement :' | tr }} <code>{{ '{' }}salon{{ '}' }}</code>, <code>{{ '{' }}adresse{{ '}' }}</code>, <code>{{ '{' }}email{{ '}' }}</code>, <code>{{ '{' }}telephone{{ '}' }}</code> {{ '(repris de « Coordonnées »).' | tr }}
        {{ 'Une ligne vide sépare les paragraphes ; « - » en début de ligne crée une liste.' | tr }}
        @if (edit.en() && !legalEnSaved()) {
          <br /><b>{{ 'Version anglaise pas encore enregistrée : les textes ci-dessous sont un modèle. Complétez-les puis enregistrez.' | tr }}</b>
        }
        @if (placeholders()) {<br /><span class="adm-err-text">{{ 'Il reste {n} élément(s) entre crochets [ ] à compléter (nom de la société, RC / ICE…).' | tr: { n: placeholders() } }}</span>}
      </div>
      @for (sec of legal(); track $index; let i = $index; let first = $first; let last = $last) {
        <section class="adm-card adm-legal">
          <div class="adm-legal-head">
            <input data-tr [(ngModel)]="sec.title" [placeholder]="'Titre de la section' | tr" [attr.aria-label]="'Titre de la section' | tr" />
            <div class="adm-row-actions">
              <button type="button" class="adm-icon-btn up" [attr.aria-label]="'Monter' | tr" [disabled]="first" (click)="move(i, -1)">↑</button>
              <button type="button" class="adm-icon-btn up" [attr.aria-label]="'Descendre' | tr" [disabled]="last" (click)="move(i, 1)">↓</button>
              <button type="button" class="adm-icon-btn" [attr.aria-label]="'Supprimer la section' | tr" (click)="removeSection(i)"><app-adm-icon name="trash" /></button>
            </div>
          </div>
          <textarea data-tr class="autogrow" rows="4" [(ngModel)]="sec.body" [attr.aria-label]="'Texte de la section' | tr"></textarea>
        </section>
      }
      <div class="adm-actions">
        <button type="button" class="adm-btn" (click)="addSection()"><app-adm-icon name="plus" /> {{ 'Ajouter une section' | tr }}</button>
        <button type="button" class="adm-btn" (click)="resetLegal()">{{ 'Remettre les textes par défaut' | tr }}</button>
        <a class="adm-btn" [href]="url('/mentions-legales')" target="_blank" rel="noopener"><app-adm-icon name="eye" /> {{ 'Voir la page' | tr }}</a>
      </div>
      <div class="adm-sticky-save"><button type="button" class="adm-btn primary" (click)="saveLegal()" [disabled]="busy()">{{ (busy() ? 'Enregistrement…' : (edit.en() ? 'Enregistrer la version anglaise' : 'Enregistrer les mentions & conditions')) | tr }}</button></div>
    }
  `,
})
export class PagesSeoPage {
  private readonly api = inject(AdminApi);
  private readonly toaster = inject(Toaster);
  private readonly content = inject(ContentService);
  private readonly picker = inject(MediaPicker);
  private readonly i18n = inject(I18nService);
  protected readonly edit = inject(EditLang);
  protected readonly fileLabels = FILE_LABELS;
  protected readonly tab = signal<'seo' | 'legal'>('seo');
  private readonly rowsByLang = signal<Record<Lang, PageRow[]>>({ fr: [], en: [] });
  private readonly legalByLang = signal<Record<Lang, LegalSection[]>>({ fr: [], en: [] });
  protected readonly legalEnSaved = signal(false);
  /** Lignes et sections de la langue modifiée. */
  protected readonly rows = computed(() => this.rowsByLang()[this.edit.lang()]);
  protected readonly legal = computed(() => this.legalByLang()[this.edit.lang()]);
  protected readonly files = signal<SeoState['files']>({});
  protected readonly busy = signal(false);
  protected readonly placeholders = computed(() => this.legal().reduce((n, s) => n + (s.body.match(/\[[^\]]+\]/g)?.length ?? 0), 0));

  constructor() {
    void this.load();
  }

  /** Adresse de la page dans la langue modifiée. */
  protected url(path: string): string {
    return localizePath(path, this.edit.lang());
  }

  private async load(): Promise<void> {
    try {
      const [seo, settings] = await Promise.all([this.api.seo(), this.api.settings()]);
      this.applySeo(seo);
      const fr = Array.isArray(settings.legal) && settings.legal.length ? settings.legal : DEFAULT_LEGAL;
      const en = Array.isArray(settings.legal_en) && settings.legal_en.length ? settings.legal_en : DEFAULT_LEGAL_EN;
      this.legalEnSaved.set(Array.isArray(settings.legal_en) && settings.legal_en.length > 0);
      this.legalByLang.set({ fr: fr.map((s) => ({ ...s })), en: en.map((s) => ({ ...s })) });
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  private applySeo(seo: SeoState): void {
    this.files.set(seo.files ?? {});
    const build = (lang: Lang): PageRow[] => {
      const overrides = lang === 'en' ? seo.overrides_en : seo.overrides;
      const defaults = lang === 'en' ? seo.defaults_en : seo.defaults;
      return Object.entries(pageSeoDefaults(lang)).map(([path, d]) => {
        const def = defaults?.[path];
        const o = overrides?.[path];
        return {
          path,
          // Nom de la page dans la langue de l'espace propriétaire
          label: PAGE_SEO[path]?.label ?? d.label,
          title: o?.title ?? '',
          description: o?.description ?? '',
          image: o?.image ?? '',
          defTitle: d.title || def?.title || '',
          defDescription: d.description || def?.description || '',
          defImage: d.image,
        };
      });
    };
    this.rowsByLang.set({ fr: build('fr'), en: build('en') });
  }

  protected async pickImage(r: PageRow): Promise<void> {
    const img = await this.picker.open(this.i18n.tr('Image de partage — {page}', { page: this.i18n.tr(r.label) }));
    if (img) {
      r.image = img.src;
      this.rowsByLang.update((l) => ({ ...l }));
    }
  }

  protected len(s: string): number {
    return [...s].length;
  }

  protected cut(s: string, n: number): string {
    return [...s].length > n ? [...s].slice(0, n - 1).join('') + '…' : s;
  }

  protected fileHelp(f: string): string {
    if (f === 'absent') return this.i18n.tr('Normal en local. En ligne, les pages seront mises à jour automatiquement.');
    if (f === 'readonly') return this.i18n.tr('Le serveur ne peut pas modifier ce fichier : vérifiez les droits d’écriture (755).');
    return this.i18n.tr('Le fichier de la page contient bien ce titre et cette description.');
  }

  protected async saveSeo(): Promise<void> {
    this.busy.set(true);
    try {
      const pages = (rows: PageRow[]): Record<string, PageSeo> =>
        Object.fromEntries(rows.map((r) => [r.path, { title: r.title.trim(), description: r.description.trim(), image: r.image }]));
      const all = this.rowsByLang();
      this.applySeo(await this.api.saveSeo(pages(all.fr), pages(all.en)));
      this.content.load(true);
      const bad = Object.values(this.files()).filter((f) => f === 'readonly').length;
      if (bad) this.toaster.error(this.i18n.tr('Enregistré, mais {n} page(s) n’ont pas pu être mises à jour sur le serveur (droits d’écriture).', { n: bad }));
      else this.toaster.ok(this.i18n.tr('Référencement enregistré. Google le prendra en compte à son prochain passage.'));
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  private updateLegal(fn: (l: LegalSection[]) => LegalSection[]): void {
    const lang = this.edit.lang();
    this.legalByLang.update((all) => ({ ...all, [lang]: fn(all[lang]) }));
  }

  protected move(i: number, d: number): void {
    this.updateLegal((l) => {
      const c = [...l];
      [c[i], c[i + d]] = [c[i + d], c[i]];
      return c;
    });
  }

  protected removeSection(i: number): void {
    if (!confirm(this.i18n.tr('Supprimer la section « {title} » ?', { title: this.legal()[i].title }))) return;
    this.updateLegal((l) => l.filter((_, j) => j !== i));
  }

  protected addSection(): void {
    this.updateLegal((l) => [...l, { id: '', title: this.edit.en() ? 'New section' : 'Nouvelle section', body: '' }]);
  }

  protected resetLegal(): void {
    if (!confirm(this.i18n.tr('Remplacer vos textes par les textes par défaut ?'))) return;
    this.updateLegal(() => (this.edit.en() ? DEFAULT_LEGAL_EN : DEFAULT_LEGAL).map((s) => ({ ...s })));
  }

  protected async saveLegal(): Promise<void> {
    const lang = this.edit.lang();
    this.busy.set(true);
    try {
      await this.api.saveLegal(this.legalByLang()[lang], lang);
      if (lang === 'en') this.legalEnSaved.set(true);
      this.content.load(true);
      this.toaster.ok(this.i18n.tr(lang === 'en' ? 'Version anglaise des mentions légales enregistrée.' : 'Mentions légales & conditions enregistrées.'));
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
