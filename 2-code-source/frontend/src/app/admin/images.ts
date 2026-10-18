import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorMessage } from '../core/api.service';
import { ContentService } from '../core/content.service';
import { CollectionItem, GALLERY_DEFAULT, INSTAGRAM_DEFAULT, SLOTS, SlotDef } from '../core/media-slots';
import { AdminApi, ImageMap, MediaItem } from './admin-api';
import { AdmIconComponent, Toaster, when } from './admin-shared';
import { MediaPicker, uploadFiles } from './media';
import { ADMIN_I18N, EditLang } from './admin-i18n';
import { I18nService, mark } from '../core/i18n';

interface SlotRow extends SlotDef {
  cur: { src: string; alt: string; alt_en: string; pos: string };
  changed: boolean;
}

const FRAMING = [
  { value: '', label: mark('Cadrage d’origine') },
  { value: '50% 15%', label: mark('Haut de la photo') },
  { value: '50% 50%', label: mark('Centre') },
  { value: '50% 85%', label: mark('Bas de la photo') },
  { value: '20% 50%', label: mark('Gauche') },
  { value: '80% 50%', label: mark('Droite') },
];

const CATS = [
  { value: 'visage', label: mark('Visage') },
  { value: 'corps', label: mark('Corps') },
  { value: 'cheveux', label: mark('Cheveux') },
  { value: 'mains-pieds', label: mark('Mains & pieds') },
  { value: 'epilation', label: mark('Épilation') },
  { value: 'lieu', label: mark('Le lieu') },
];

@Component({
  selector: 'app-admin-images',
  imports: [FormsModule, AdmIconComponent, ADMIN_I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-page-head">
      <div>
        <h1>{{ 'Images du site' | tr }}</h1>
        <p class="adm-muted">{{ 'Changez les photos de chaque section, de la galerie et de l’accueil. « Remettre l’originale » revient à la photo d’origine ; les photos envoyées restent dans la médiathèque.' | tr }}</p>
      </div>
      <a class="adm-btn" [href]="edit.en() ? '/en' : '/'" target="_blank" rel="noopener"><app-adm-icon name="eye" /> {{ 'Voir le site' | tr }}</a>
    </div>

    @if (tab() !== 'library') {
      <app-edit-lang note="Les photos et le cadrage sont communs aux deux langues ; seuls les textes (description, légendes) se traduisent." />
    }

    <div class="adm-tabs">
      <button type="button" [class.active]="tab() === 'slots'" (click)="tab.set('slots')"><app-adm-icon name="image" /> {{ 'Photos des sections' | tr }}</button>
      <button type="button" [class.active]="tab() === 'gallery'" (click)="tab.set('gallery')">{{ 'Galerie' | tr }} <b>{{ gallery().length }}</b></button>
      <button type="button" [class.active]="tab() === 'instagram'" (click)="tab.set('instagram')">{{ 'Publications de l’accueil' | tr }} <b>{{ instagram().length }}</b></button>
      <button type="button" [class.active]="tab() === 'library'" (click)="openLibrary()">{{ 'Médiathèque' | tr }} <b>{{ library().length }}</b></button>
    </div>

    @switch (tab()) {
      @case ('slots') {
        @for (g of groups; track g) {
          <h2 class="adm-subtitle">{{ g | tr }}</h2>
          <div class="adm-slots">
            @for (s of byGroup(g); track s.key) {
              <article class="adm-slot" [class.changed]="s.changed">
                <div class="adm-slot-img"><img [src]="s.cur.src" [alt]="s.cur.alt" [style.object-position]="s.cur.pos" loading="lazy" /></div>
                <div class="adm-slot-body">
                  <h3>{{ slotLabel(s) }}</h3>
                  <p class="adm-muted">{{ s.hint | tr }}</p>
                  @if (isCustom(s)) {<span class="adm-pill ok">{{ 'Photo personnalisée' | tr }}</span>}
                  <label>{{ 'Texte alternatif' | tr }} <em>{{ '(décrit la photo pour Google)' | tr }}</em>
                    <input data-tr [ngModel]="edit.get(s.cur, 'alt')" (ngModelChange)="edit.set_(s.cur, 'alt', $event); s.changed = true" [placeholder]="altPlaceholder(s)" maxlength="160" />
                  </label>
                  <label>{{ 'Cadrage' | tr }}
                    <select [(ngModel)]="posChoice[s.key]" (ngModelChange)="setPos(s, $event)">
                      @for (f of framing; track f.value) {<option [value]="f.value">{{ f.label | tr }}</option>}
                    </select>
                  </label>
                  <div class="adm-actions" style="margin-top: 4px">
                    <button type="button" class="adm-btn sm primary" (click)="change(s)"><app-adm-icon name="image" /> {{ 'Changer la photo' | tr }}</button>
                    @if (isCustom(s)) {<button type="button" class="adm-btn sm" (click)="reset(s)">{{ 'Remettre l’originale' | tr }}</button>}
                  </div>
                </div>
              </article>
            }
          </div>
        }
        <div class="adm-sticky-save"><button type="button" class="adm-btn primary" (click)="saveSlots()" [disabled]="busy() || !dirtySlots()">{{ (busy() ? 'Enregistrement…' : 'Enregistrer les photos') | tr }}</button></div>
      }

      @case ('library') {
        <div class="adm-card adm-tip">{{ 'Toutes les photos envoyées. Une photo utilisée sur le site ne peut pas être supprimée : remplacez-la d’abord. Le texte alternatif aide Google à comprendre la photo.' | tr }}</div>
        <label class="adm-btn primary adm-upload" style="margin-bottom: 18px">
          <app-adm-icon name="plus" /> {{ (busy() ? 'Envoi…' : 'Envoyer des photos') | tr }}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple (change)="uploadToLibrary($event)" [disabled]="busy()" />
        </label>
        @if (!library().length) {<p class="adm-empty">{{ 'La médiathèque est vide.' | tr }}</p>}
        <div class="adm-lib">
          @for (m of library(); track m.id) {
            <article class="adm-lib-item">
              <img [src]="m.url" [alt]="m.alt" loading="lazy" />
              <div>
                <input [(ngModel)]="m.alt" [placeholder]="'Texte alternatif (ex. Soin du visage à Marrakech)' | tr" (change)="saveAlt(m)" [attr.aria-label]="'Texte alternatif' | tr" />
                <p class="adm-muted">{{ m.width }} × {{ m.height }} · {{ kb(m.size) }} · {{ when(m.created_at) }}</p>
                <div class="adm-actions" style="margin-top: 6px">
                  <button type="button" class="adm-btn sm" (click)="copyUrl(m)"><app-adm-icon name="copy" /> {{ 'Copier l’adresse' | tr }}</button>
                  <button type="button" class="adm-icon-btn" [attr.aria-label]="'Supprimer' | tr" (click)="removeMedia(m)"><app-adm-icon name="trash" /></button>
                </div>
              </div>
            </article>
          }
        </div>
      }

      @default {
        @let key = collectionKey();
        <div class="adm-card adm-tip">
          @if (key === 'gallery') { {{ 'Photos de la page Galerie, dans l’ordre d’affichage. La catégorie sert aux filtres (Visage, Corps…).' | tr }} }
          @else { {{ 'Photos du bandeau défilant « Suivez l’univers OPAAL » de l’accueil (format portrait conseillé).' | tr }} }
        </div>
        <div class="adm-coll">
          @for (it of collection(); track $index; let i = $index; let first = $first; let last = $last) {
            <article class="adm-coll-item">
              <img [src]="it.src" [alt]="it.caption" loading="lazy" />
              <div class="adm-coll-fields">
                <input data-tr [ngModel]="edit.get(it, 'caption')" (ngModelChange)="edit.set_(it, 'caption', $event); collDirty.set(true)"
                  [placeholder]="edit.en() ? (it.caption | tr) : ('Légende' | tr)" maxlength="120" [attr.aria-label]="'Légende' | tr" />
                <select [(ngModel)]="it.cat" (ngModelChange)="collDirty.set(true)" [attr.aria-label]="'Catégorie' | tr">
                  @for (c of cats; track c.value) {<option [value]="c.value">{{ c.label | tr }}</option>}
                </select>
              </div>
              <div class="adm-row-actions">
                <button type="button" class="adm-icon-btn up" [attr.aria-label]="'Monter' | tr" [disabled]="first" (click)="move(i, -1)"><app-adm-icon name="up" /></button>
                <button type="button" class="adm-icon-btn up" [attr.aria-label]="'Descendre' | tr" [disabled]="last" (click)="move(i, 1)"><app-adm-icon name="down" /></button>
                <button type="button" class="adm-icon-btn up" [attr.aria-label]="'Changer la photo' | tr" (click)="replaceItem(i)"><app-adm-icon name="image" /></button>
                <button type="button" class="adm-icon-btn" [attr.aria-label]="'Retirer' | tr" (click)="removeItem(i)"><app-adm-icon name="trash" /></button>
              </div>
            </article>
          }
        </div>
        <div class="adm-actions">
          <button type="button" class="adm-btn" (click)="addItem()"><app-adm-icon name="plus" /> {{ 'Ajouter une photo' | tr }}</button>
          <button type="button" class="adm-btn" (click)="resetCollection()">{{ 'Remettre les photos d’origine' | tr }}</button>
        </div>
        <div class="adm-sticky-save"><button type="button" class="adm-btn primary" (click)="saveCollection()" [disabled]="busy() || !collDirty()">{{ (busy() ? 'Enregistrement…' : 'Enregistrer') | tr }}</button></div>
      }
    }
  `,
})
export class ImagesPage {
  private readonly api = inject(AdminApi);
  private readonly toaster = inject(Toaster);
  private readonly content = inject(ContentService);
  private readonly picker = inject(MediaPicker);
  private readonly i18n = inject(I18nService);
  protected readonly edit = inject(EditLang);
  protected readonly framing = FRAMING;
  protected readonly cats = CATS;
  protected readonly when = when;
  protected readonly groups = [...new Set(SLOTS.map((s) => s.group))];
  protected readonly tab = signal<'slots' | 'gallery' | 'instagram' | 'library'>('slots');
  protected readonly rows = signal<SlotRow[]>([]);
  protected readonly gallery = signal<CollectionItem[]>([]);
  protected readonly instagram = signal<CollectionItem[]>([]);
  protected readonly library = signal<MediaItem[]>([]);
  protected readonly busy = signal(false);
  protected readonly collDirty = signal(false);
  protected readonly dirtySlots = computed(() => this.rows().some((r) => r.changed));
  protected readonly collectionKey = computed(() => (this.tab() === 'instagram' ? 'instagram' : 'gallery'));
  protected readonly collection = computed(() => (this.collectionKey() === 'instagram' ? this.instagram() : this.gallery()));
  protected posChoice: Record<string, string> = {};
  private saved: ImageMap = {};

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [st, lib] = await Promise.all([this.api.settings(), this.api.media()]);
      this.saved = st.images && !Array.isArray(st.images) ? st.images : {};
      this.rows.set(SLOTS.map((s) => this.row(s)));
      this.gallery.set((st.gallery ?? GALLERY_DEFAULT).map((i) => ({ ...i })));
      this.instagram.set((st.feed ?? INSTAGRAM_DEFAULT).map((i) => ({ ...i })));
      this.library.set(lib);
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  private row(s: SlotDef): SlotRow {
    const o = this.saved[s.key] ?? {};
    this.posChoice[s.key] = o.pos ?? '';
    return { ...s, cur: { src: o.src || s.src, alt: o.alt || '', alt_en: o.alt_en || '', pos: o.pos || s.pos }, changed: false };
  }

  protected slotLabel(s: SlotRow): string {
    return this.i18n.tr(s.label, { cat: s.cat ? this.i18n.tr(s.cat) : '' });
  }

  /** Modèle affiché dans le champ vide : texte d'origine (ou, en anglais, texte français / traduction d'origine). */
  protected altPlaceholder(s: SlotRow): string {
    if (!this.edit.en()) return s.alt;
    return s.cur.alt || this.i18n.tr(s.alt);
  }

  protected byGroup(g: string): SlotRow[] {
    return this.rows().filter((r) => r.group === g);
  }

  protected isCustom(s: SlotRow): boolean {
    return s.cur.src !== s.src || !!s.cur.alt || !!s.cur.alt_en || !!this.posChoice[s.key];
  }

  protected setPos(s: SlotRow, v: string): void {
    s.cur.pos = v || s.pos;
    s.changed = true;
    this.rows.update((l) => [...l]);
  }

  protected async change(s: SlotRow): Promise<void> {
    const img = await this.picker.open(this.slotLabel(s));
    if (!img) return;
    s.cur.src = img.src;
    if (img.alt && !s.cur.alt) s.cur.alt = img.alt;
    s.changed = true;
    this.rows.update((l) => [...l]);
  }

  protected reset(s: SlotRow): void {
    s.cur = { src: s.src, alt: '', alt_en: '', pos: s.pos };
    this.posChoice[s.key] = '';
    s.changed = true;
    this.rows.update((l) => [...l]);
  }

  protected async saveSlots(): Promise<void> {
    const map: ImageMap = {};
    for (const r of this.rows()) {
      const src = r.cur.src !== r.src ? r.cur.src : '';
      const pos = this.posChoice[r.key] || '';
      if (src || r.cur.alt || r.cur.alt_en || pos) map[r.key] = { src, alt: r.cur.alt, alt_en: r.cur.alt_en, pos };
    }
    this.busy.set(true);
    try {
      const res = await this.api.saveImages(map);
      this.saved = res.images && !Array.isArray(res.images) ? res.images : {};
      this.rows.set(SLOTS.map((s) => this.row(s)));
      this.content.load(true);
      const bad = Object.values(res.files ?? {}).filter((f) => f === 'readonly').length;
      if (bad) this.toaster.error(this.i18n.tr('Enregistré, mais {n} page(s) n’ont pas pu être mises à jour sur le serveur (droits d’écriture).', { n: bad }));
      else this.toaster.ok(this.i18n.tr('Photos enregistrées : le site est à jour.'));
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  /* ---------- Galerie & publications ---------- */

  private setColl(items: CollectionItem[]): void {
    (this.collectionKey() === 'instagram' ? this.instagram : this.gallery).set(items);
    this.collDirty.set(true);
  }

  protected move(i: number, d: number): void {
    const l = [...this.collection()];
    [l[i], l[i + d]] = [l[i + d], l[i]];
    this.setColl(l);
  }

  protected removeItem(i: number): void {
    this.setColl(this.collection().filter((_, j) => j !== i));
  }

  protected async addItem(): Promise<void> {
    const img = await this.picker.open(this.i18n.tr('Ajouter une photo'));
    if (img) this.setColl([...this.collection(), { src: img.src, caption: img.alt, cat: 'visage' }]);
  }

  protected async replaceItem(i: number): Promise<void> {
    const img = await this.picker.open(this.i18n.tr('Changer la photo'));
    if (!img) return;
    const l = [...this.collection()];
    l[i] = { ...l[i], src: img.src };
    this.setColl(l);
  }

  protected resetCollection(): void {
    if (!confirm(this.i18n.tr('Remettre les photos d’origine ? Vos changements sur cette liste seront perdus.'))) return;
    void this.persistCollection(null);
  }

  protected saveCollection(): Promise<void> {
    return this.persistCollection(this.collection().map((i) => ({ src: i.src, caption: i.caption, caption_en: i.caption_en ?? '', cat: i.cat })));
  }

  private async persistCollection(items: { src: string; caption: string; caption_en?: string; cat: string }[] | null): Promise<void> {
    const key = this.collectionKey();
    this.busy.set(true);
    try {
      const res = await this.api.saveCollection(key === 'instagram' ? 'feed' : 'gallery', items);
      const list = res.items ?? (key === 'instagram' ? INSTAGRAM_DEFAULT : GALLERY_DEFAULT);
      (key === 'instagram' ? this.instagram : this.gallery).set(list.map((i) => ({ ...i })));
      this.collDirty.set(false);
      this.content.load(true);
      this.toaster.ok(this.i18n.tr(items === null ? 'Photos d’origine remises.' : 'Enregistré.'));
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  /* ---------- Médiathèque ---------- */

  protected async openLibrary(): Promise<void> {
    this.tab.set('library');
    try {
      this.library.set(await this.api.media());
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected async uploadToLibrary(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.busy.set(true);
    const added = await uploadFiles(this.api, this.toaster, input.files);
    this.library.update((l) => [...added, ...l]);
    this.busy.set(false);
    input.value = '';
  }

  protected async saveAlt(m: MediaItem): Promise<void> {
    try {
      await this.api.updateMedia(m.id, m.alt);
      this.toaster.ok(this.i18n.tr('Texte alternatif enregistré.'));
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected async copyUrl(m: MediaItem): Promise<void> {
    try {
      await navigator.clipboard.writeText(`![${m.alt || m.name}](${m.url})`);
      this.toaster.ok(this.i18n.tr('Code copié : collez-le dans un article ou une newsletter pour y insérer la photo.'));
    } catch {
      this.toaster.error(m.url);
    }
  }

  protected async removeMedia(m: MediaItem): Promise<void> {
    if (!confirm(this.i18n.tr('Supprimer définitivement cette photo ?'))) return;
    try {
      await this.api.deleteMedia(m.id);
      this.library.update((l) => l.filter((x) => x.id !== m.id));
      this.toaster.ok(this.i18n.tr('Photo supprimée.'));
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected kb(n: number): string {
    const en = this.i18n.lang() === 'en';
    return n > 1_000_000
      ? (n / 1_000_000).toFixed(1).replace('.', en ? '.' : ',') + (en ? ' MB' : ' Mo')
      : Math.round(n / 1000) + (en ? ' KB' : ' Ko');
  }
}
