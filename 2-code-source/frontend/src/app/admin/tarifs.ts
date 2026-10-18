import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorMessage } from '../core/api.service';
import { ContentService } from '../core/content.service';
import { formatDuration, formatPrice } from '../core/format';
import { I18nService } from '../core/i18n';
import { Category, Service } from '../core/models';
import { AdminApi } from './admin-api';
import { AdmIconComponent, Toaster } from './admin-shared';
import { ADMIN_I18N, EditLang } from './admin-i18n';

interface Row extends Service {
  priceText: string;
  dirty: boolean;
  saving: boolean;
}

interface Cat extends Omit<Category, 'services'> {
  services: Row[];
  dirty: boolean;
}

@Component({
  selector: 'app-admin-tarifs',
  imports: [FormsModule, AdmIconComponent, ADMIN_I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-page-head">
      <div>
        <h1>{{ 'Soins & tarifs' | tr }}</h1>
        <p class="adm-muted">{{ 'Modifiez les soins, les prix et les durées : la page « Soins » du site se met à jour immédiatement. Laissez le prix vide pour afficher « Sur demande ».' | tr }}</p>
      </div>
      <a class="adm-btn" [href]="edit.en() ? '/en/soins' : '/soins'" target="_blank" rel="noopener"><app-adm-icon name="eye" /> {{ 'Voir la page Soins' | tr }}</a>
    </div>

    <app-edit-lang note="Les prix, durées et la visibilité sont communs aux deux langues." />

    @if (loading()) {
      <div class="adm-loading"><span></span><span></span><span></span></div>
    }

    @for (c of cats(); track c.id) {
      <section class="adm-card adm-cat" [class.open]="openCat() === c.id">
        <button type="button" class="adm-cat-head" (click)="openCat.set(openCat() === c.id ? null : c.id)">
          <div>
            <h2>{{ edit.en() ? (c.title_en || c.title) : c.title }}</h2>
            <span>{{ '{n} soins · {p} avec prix' | tr: { n: c.services.length, p: priced(c) } }}@if (edit.en() && missing(c)) { · <b class="adm-warn">{{ '{n} à traduire' | tr: { n: missing(c) } }}</b>}</span>
          </div>
          <span class="chev" aria-hidden="true"></span>
        </button>
        @if (openCat() === c.id) {
          <div class="adm-cat-body">
            <div class="adm-row2 wide">
              <label>{{ 'Titre de la catégorie' | tr }}
                <input data-tr [ngModel]="edit.get(c, 'title')" (ngModelChange)="edit.set_(c, 'title', $event); c.dirty = true" [placeholder]="edit.ph(c, 'title')" />
              </label>
              <label>{{ 'Présentation' | tr }} <em>({{ edit.get(c, 'intro').length }}/400)</em>
                <textarea data-tr class="autogrow" rows="2" maxlength="400" [ngModel]="edit.get(c, 'intro')" (ngModelChange)="edit.set_(c, 'intro', $event); c.dirty = true" [placeholder]="edit.ph(c, 'intro')"></textarea>
              </label>
            </div>
            @if (c.dirty) {<button type="button" class="adm-btn primary sm" (click)="saveCat(c)">{{ 'Enregistrer la catégorie' | tr }}</button>}

            <div class="adm-svcs">
              @for (s of c.services; track s.id) {
                <div class="adm-svc" [class.hidden-row]="!s.active" [class.dirty]="s.dirty">
                  <label class="f-name">{{ 'Soin' | tr }}
                    <input data-tr [ngModel]="edit.get(s, 'name')" (ngModelChange)="edit.set_(s, 'name', $event); s.dirty = true" [placeholder]="edit.ph(s, 'name')" />
                  </label>
                  <label class="f-price">{{ 'Prix ({currency})' | tr: { currency: currency() } }}<input inputmode="decimal" [placeholder]="'Sur demande' | tr" [(ngModel)]="s.priceText" (ngModelChange)="s.dirty = true" /></label>
                  <div class="f-sw f-from"><span>{{ 'À partir de' | tr }}</span><label class="adm-switch" [attr.aria-label]="'Prix « à partir de »' | tr"><input type="checkbox" [(ngModel)]="s.price_from" (ngModelChange)="s.dirty = true" /><i></i></label></div>
                  <label class="f-dur">{{ 'Durée (min)' | tr }}<input type="number" min="5" max="600" step="5" placeholder="—" [(ngModel)]="s.duration" (ngModelChange)="s.dirty = true" /></label>
                  <div class="f-sw f-vis"><span>{{ 'Visible' | tr }}</span><label class="adm-switch" [attr.aria-label]="'Visible sur le site' | tr"><input type="checkbox" [(ngModel)]="s.active" (ngModelChange)="s.dirty = true" /><i></i></label></div>
                  <div class="adm-row-actions">
                    @if (s.dirty) {<button type="button" class="adm-btn primary sm" (click)="saveRow(s)" [disabled]="s.saving">{{ 'Enregistrer' | tr }}</button>}
                    <button type="button" class="adm-icon-btn" [attr.aria-label]="'Supprimer' | tr" (click)="removeRow(c, s)"><app-adm-icon name="trash" /></button>
                  </div>
                  <label class="f-grp">{{ 'Rubrique' | tr }}
                    <input data-tr maxlength="60" [ngModel]="edit.get(s, 'grp')" (ngModelChange)="edit.set_(s, 'grp', $event); s.dirty = true" [placeholder]="edit.ph(s, 'grp', 'Ex. Coloration (facultatif)' | tr)" />
                  </label>
                  <label class="f-desc">{{ 'Description' | tr }} <em>({{ edit.get(s, 'description').length }}/600)</em>
                    <textarea data-tr class="autogrow" rows="2" maxlength="600" [placeholder]="edit.ph(s, 'description', 'Décrivez le soin : bienfaits, déroulé, pour qui…' | tr)"
                      [ngModel]="edit.get(s, 'description')" (ngModelChange)="edit.set_(s, 'description', $event); s.dirty = true"></textarea>
                  </label>
                  <small class="adm-preview">{{ 'Sur le site :' | tr }} <b>{{ preview(s) }}</b>{{ s.duration ? ' · ' + dur(s.duration) : '' }}{{ s.active ? '' : ' · ' + ('masqué' | tr) }}</small>
                </div>
              }
            </div>
            <div class="adm-actions">
              <button type="button" class="adm-btn" (click)="addRow(c)"><app-adm-icon name="plus" /> {{ 'Ajouter un soin' | tr }}</button>
              @if (hasDirty(c)) {<button type="button" class="adm-btn primary" (click)="saveAll(c)">{{ 'Tout enregistrer' | tr }}</button>}
            </div>
          </div>
        }
      </section>
    }
  `,
})
export class TarifsPage {
  private readonly api = inject(AdminApi);
  private readonly toaster = inject(Toaster);
  private readonly content = inject(ContentService);
  private readonly i18n = inject(I18nService);
  protected readonly edit = inject(EditLang);
  protected readonly cats = signal<Cat[]>([]);
  protected readonly loading = signal(true);
  protected readonly openCat = signal<number | null>(null);
  protected readonly currency = computed(() => this.content.settings().currency || 'DH');

  constructor() {
    void this.load();
  }

  protected dur(m: number | null): string {
    return formatDuration(m, this.edit.lang());
  }

  private toRow(s: Service): Row {
    return {
      ...s, name_en: s.name_en ?? '', description_en: s.description_en ?? '', grp: s.grp ?? '', grp_en: s.grp_en ?? '',
      priceText: s.price === null ? '' : String(s.price).replace('.', ','), dirty: false, saving: false,
    };
  }

  private async load(): Promise<void> {
    try {
      const cats = await this.api.catalog();
      this.cats.set(cats.map((c) => ({ ...c, title_en: c.title_en ?? '', intro_en: c.intro_en ?? '', dirty: false, services: c.services.map((s) => this.toRow(s)) })));
      if (this.openCat() === null && cats[0]) this.openCat.set(cats[0].id);
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected priced(c: Cat): number {
    return c.services.filter((s) => s.priceText.trim() !== '').length;
  }

  /** Textes encore sans version anglaise (titre, présentation, soins). */
  protected missing(c: Cat): number {
    const need = (fr: string, en: string | undefined) => (fr.trim() && !(en ?? '').trim() ? 1 : 0);
    return need(c.title, c.title_en) + need(c.intro, c.intro_en)
      + c.services.reduce((n, s) => n + need(s.name, s.name_en) + need(s.description, s.description_en), 0);
  }

  protected hasDirty(c: Cat): boolean {
    return c.services.some((s) => s.dirty);
  }

  protected preview(s: Row): string {
    const raw = s.priceText.replace(/\s/g, '').replace(',', '.');
    const price = raw === '' || isNaN(Number(raw)) ? null : Number(raw);
    return formatPrice({ price, price_from: s.price_from }, this.content.settings().currency || 'DH', this.edit.lang());
  }

  private body(s: Row): Partial<Service> & { price: number | null } {
    const raw = s.priceText.replace(/\s/g, '').replace(',', '.');
    return {
      name: s.name,
      description: s.description,
      name_en: s.name_en ?? '',
      description_en: s.description_en ?? '',
      grp: s.grp ?? '',
      grp_en: s.grp_en ?? '',
      price: raw === '' ? null : Number(raw),
      price_from: s.price_from,
      duration: s.duration || null,
      active: s.active,
    };
  }

  protected async saveRow(s: Row, silent = false): Promise<boolean> {
    s.saving = true;
    try {
      const saved = await this.api.updateService(s.id, this.body(s));
      Object.assign(s, this.toRow(saved));
      this.cats.update((c) => [...c]);
      if (!silent) this.toaster.ok(this.i18n.tr('« {name} » enregistré.', { name: this.edit.en() ? saved.name_en || saved.name : saved.name }));
      this.content.load(true);
      return true;
    } catch (e) {
      s.saving = false;
      this.cats.update((c) => [...c]);
      this.toaster.error(errorMessage(e));
      return false;
    }
  }

  protected async saveAll(c: Cat): Promise<void> {
    let ok = 0;
    for (const s of c.services.filter((x) => x.dirty)) {
      if (await this.saveRow(s, true)) ok++;
    }
    if (ok) this.toaster.ok(this.i18n.tr(ok > 1 ? '{n} soins enregistrés.' : '{n} soin enregistré.', { n: ok }));
  }

  protected async saveCat(c: Cat): Promise<void> {
    try {
      await this.api.updateCategory(c.id, { title: c.title, intro: c.intro, title_en: c.title_en ?? '', intro_en: c.intro_en ?? '' });
      c.dirty = false;
      this.cats.update((l) => [...l]);
      this.toaster.ok(this.i18n.tr('Catégorie enregistrée.'));
      this.content.load(true);
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected async addRow(c: Cat): Promise<void> {
    try {
      const created = await this.api.createService({ category_id: c.id, name: this.i18n.tr('Nouveau soin'), description: '', price: null, price_from: false, active: false });
      c.services.push({ ...this.toRow(created), dirty: false });
      this.cats.update((l) => [...l]);
      this.toaster.ok(this.i18n.tr('Soin ajouté (masqué) : complétez-le puis rendez-le visible.'));
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected async removeRow(c: Cat, s: Row): Promise<void> {
    if (!confirm(this.i18n.tr('Supprimer le soin « {name} » ?', { name: s.name }))) return;
    try {
      await this.api.deleteService(s.id);
      c.services = c.services.filter((x) => x.id !== s.id);
      this.cats.update((l) => [...l]);
      this.toaster.ok(this.i18n.tr('Soin supprimé.'));
      this.content.load(true);
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }
}
