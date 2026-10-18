import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorMessage } from '../core/api.service';
import { ContentService } from '../core/content.service';
import { I18nService, mark } from '../core/i18n';
import { Offer } from '../core/models';
import { AdminApi } from './admin-api';
import { AdmIconComponent, Toaster } from './admin-shared';
import { ADMIN_I18N, EditLang } from './admin-i18n';

interface Draft extends Omit<Offer, 'id' | 'perks' | 'perks_en'> {
  id: number | null;
  perksText: string;
  perksText_en: string;
}

@Component({
  selector: 'app-admin-offers',
  imports: [FormsModule, AdmIconComponent, ADMIN_I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-page-head">
      <div>
        <h1>{{ 'Offres & formules' | tr }}</h1>
        <p class="adm-muted">
          <b>{{ 'Formules du club' | tr }}</b> : {{ 'affichées sur la page Membership.' | tr }}
          <b>{{ 'Offres du moment' | tr }}</b> : {{ 'affichées en bandeau sur l’accueil (activez-les quand vous le souhaitez).' | tr }}
        </p>
      </div>
      <button type="button" class="adm-btn primary" (click)="editOffer(null)"><app-adm-icon name="plus" /> {{ 'Nouvelle offre' | tr }}</button>
    </div>

    <app-edit-lang note="Le type, l’ordre, la visibilité et la mise en avant sont communs aux deux langues." />

    @if (draft(); as d) {
      <form class="adm-card adm-form-card" (ngSubmit)="save()">
        <h2>{{ (d.id ? 'Modifier l’offre' : 'Nouvelle offre') | tr }}</h2>
        <div class="adm-row3">
          <label>{{ 'Type' | tr }}
            <select name="type" [(ngModel)]="d.type">
              <option value="formule">{{ 'Formule du club (page Membership)' | tr }}</option>
              <option value="promo">{{ 'Offre du moment (bandeau accueil)' | tr }}</option>
            </select>
          </label>
          <label>{{ 'Titre' | tr }}<input data-tr name="title" [required]="!edit.en()" [ngModel]="edit.get(d, 'title')" (ngModelChange)="edit.set_(d, 'title', $event)" [placeholder]="edit.ph(d, 'title', 'ex. Opale' | tr)" /></label>
          <label>{{ 'Sous-titre' | tr }}<input data-tr name="subtitle" [ngModel]="edit.get(d, 'subtitle')" (ngModelChange)="edit.set_(d, 'subtitle', $event)" [placeholder]="edit.ph(d, 'subtitle', 'ex. L’équilibre parfait' | tr)" /></label>
        </div>
        <label>{{ 'Description' | tr }}<textarea data-tr name="description" rows="2" [ngModel]="edit.get(d, 'description')" (ngModelChange)="edit.set_(d, 'description', $event)" [placeholder]="edit.ph(d, 'description')"></textarea></label>
        <label>{{ 'Avantages' | tr }} <em>{{ '(un par ligne)' | tr }}</em><textarea data-tr name="perks" rows="4" [ngModel]="edit.get(d, 'perksText')" (ngModelChange)="edit.set_(d, 'perksText', $event)" [placeholder]="edit.ph(d, 'perksText')"></textarea></label>
        <div class="adm-row3">
          <label>{{ 'Prix affiché' | tr }}<input data-tr name="price" [ngModel]="edit.get(d, 'price')" (ngModelChange)="edit.set_(d, 'price', $event)" [placeholder]="edit.ph(d, 'price', 'ex. 1 200 DH / an — vide = « sur demande »' | tr)" /></label>
          <label>{{ 'Badge' | tr }}<input data-tr name="badge" [ngModel]="edit.get(d, 'badge')" (ngModelChange)="edit.set_(d, 'badge', $event)" [placeholder]="edit.ph(d, 'badge', 'ex. Signature, -20 %' | tr)" /></label>
          <label>{{ 'Ordre d’affichage' | tr }}<input name="sort" type="number" min="0" [(ngModel)]="d.sort" /></label>
        </div>
        <div class="adm-checks">
          <label class="adm-check"><input type="checkbox" name="active" [(ngModel)]="d.active" /> {{ 'Visible sur le site' | tr }}</label>
          <label class="adm-check"><input type="checkbox" name="featured" [(ngModel)]="d.featured" /> {{ 'Mettre en avant (carte noire)' | tr }}</label>
        </div>
        <div class="adm-actions">
          <button class="adm-btn primary" type="submit" [disabled]="busy()">{{ 'Enregistrer' | tr }}</button>
          <button type="button" class="adm-btn" (click)="draft.set(null)">{{ 'Annuler' | tr }}</button>
        </div>
      </form>
    }

    @for (group of groups; track group.type) {
      <h2 class="adm-subtitle">{{ group.label | tr }}</h2>
      <div class="adm-offers">
        @for (o of byType(group.type); track o.id) {
          <article class="adm-offer" [class.off]="!o.active" [class.featured]="o.featured">
            <header>
              @if (text(o.badge, o.badge_en)) {<span class="adm-pill gold">{{ text(o.badge, o.badge_en) }}</span>}
              <span class="adm-pill" [class.ok]="o.active">{{ (o.active ? 'Visible' : 'Masquée') | tr }}</span>
              @if (edit.en() && !o.title_en) {<span class="adm-pill">{{ 'À traduire' | tr }}</span>}
            </header>
            <h3>{{ text(o.title, o.title_en) }}</h3>
            <p class="sub">{{ text(o.subtitle, o.subtitle_en) }}</p>
            @if (text(o.description, o.description_en)) {<p>{{ text(o.description, o.description_en) }}</p>}
            @if (perks(o).length) {<ul>@for (p of perks(o); track $index) {<li>{{ p }}</li>}</ul>}
            <p class="price">{{ text(o.price, o.price_en) || ('Tarif sur demande' | tr) }}</p>
            <div class="adm-actions">
              <button type="button" class="adm-btn sm" (click)="editOffer(o)">{{ 'Modifier' | tr }}</button>
              <button type="button" class="adm-btn sm" (click)="toggle(o)">{{ (o.active ? 'Masquer' : 'Afficher') | tr }}</button>
              <button type="button" class="adm-icon-btn" [attr.aria-label]="'Supprimer' | tr" (click)="remove(o)"><app-adm-icon name="trash" /></button>
            </div>
          </article>
        } @empty {
          <p class="adm-empty">{{ 'Aucune offre de ce type.' | tr }}</p>
        }
      </div>
    }
  `,
})
export class OffersPage {
  private readonly api = inject(AdminApi);
  private readonly toaster = inject(Toaster);
  private readonly content = inject(ContentService);
  private readonly i18n = inject(I18nService);
  protected readonly edit = inject(EditLang);
  protected readonly offers = signal<Offer[]>([]);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly busy = signal(false);
  protected readonly groups = [
    { type: 'promo' as const, label: mark('Offres du moment') },
    { type: 'formule' as const, label: mark('Formules du club') },
  ];

  constructor() {
    void this.load();
  }

  protected byType(t: 'promo' | 'formule'): Offer[] {
    return this.offers().filter((o) => o.type === t);
  }

  /** Texte dans la langue modifiée (anglais vide = français). */
  protected text(fr: string, en: string | undefined): string {
    return this.edit.en() && en?.trim() ? en : fr;
  }

  protected perks(o: Offer): string[] {
    return this.edit.en() && o.perks_en?.length ? o.perks_en : o.perks;
  }

  private async load(): Promise<void> {
    try {
      this.offers.set(await this.api.offers());
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected editOffer(o: Offer | null): void {
    this.draft.set(
      o
        ? {
            ...o, title_en: o.title_en ?? '', subtitle_en: o.subtitle_en ?? '', description_en: o.description_en ?? '',
            price_en: o.price_en ?? '', badge_en: o.badge_en ?? '',
            perksText: o.perks.join('\n'), perksText_en: (o.perks_en ?? []).join('\n'),
          }
        : {
            id: null, type: 'promo', title: '', subtitle: this.i18n.tr('Offre du moment'), description: '', perksText: '', price: '', badge: '',
            featured: false, active: true, sort: this.offers().length,
            title_en: '', subtitle_en: '', description_en: '', perksText_en: '', price_en: '', badge_en: '',
          },
    );
    setTimeout(() => document.querySelector('.adm-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  private payload(d: Draft): Partial<Offer> & { perks: string[] } {
    const lines = (t: string) => t.split('\n').map((p) => p.trim()).filter(Boolean);
    return {
      type: d.type, title: d.title, subtitle: d.subtitle, description: d.description, perks: lines(d.perksText),
      price: d.price, badge: d.badge, featured: d.featured, active: d.active, sort: Number(d.sort) || 0,
      title_en: d.title_en ?? '', subtitle_en: d.subtitle_en ?? '', description_en: d.description_en ?? '',
      perks_en: lines(d.perksText_en), price_en: d.price_en ?? '', badge_en: d.badge_en ?? '',
    };
  }

  protected async save(): Promise<void> {
    const d = this.draft();
    if (!d) return;
    if (!d.title.trim()) {
      this.edit.set('fr');
      this.toaster.error(this.i18n.tr('Indiquez d’abord le titre en français.'));
      return;
    }
    this.busy.set(true);
    try {
      if (d.id) {
        await this.api.updateOffer(d.id, this.payload(d));
      } else {
        await this.api.createOffer(this.payload(d));
      }
      this.draft.set(null);
      await this.load();
      this.toaster.ok(this.i18n.tr('Offre enregistrée.'));
      this.content.load(true);
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async toggle(o: Offer): Promise<void> {
    try {
      await this.api.updateOffer(o.id, { ...o, active: !o.active });
      await this.load();
      this.toaster.ok(this.i18n.tr(o.active ? 'Offre masquée.' : 'Offre visible sur le site.'));
      this.content.load(true);
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected async remove(o: Offer): Promise<void> {
    if (!confirm(this.i18n.tr('Supprimer l’offre « {name} » ?', { name: o.title }))) return;
    try {
      await this.api.deleteOffer(o.id);
      await this.load();
      this.toaster.ok(this.i18n.tr('Offre supprimée.'));
      this.content.load(true);
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }
}
