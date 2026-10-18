import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorMessage } from '../core/api.service';
import { slugify } from '../core/markup';
import { BlogPost } from '../core/models';
import { I18nService, mark } from '../core/i18n';
import { PostContentComponent } from '../shared/post-content';
import { AdminApi, PostInput } from './admin-api';
import { AdmIconComponent, StatusComponent, Toaster, shortDate } from './admin-shared';
import { MediaPicker } from './media';
import { ADMIN_I18N, EditLang } from './admin-i18n';

interface Draft extends PostInput {
  id: number | null;
  slugTouched: boolean;
}

const empty = (): Draft => ({
  id: null, title: '', slug: '', excerpt: '', content: '', category: '', cover: '', cover_alt: '',
  seo_title: '', seo_description: '', status: 'draft', published_at: '', slugTouched: false,
  title_en: '', excerpt_en: '', content_en: '', category_en: '', cover_alt_en: '', seo_title_en: '', seo_description_en: '',
});

/** Champs traduisibles d'un article. */
type TextField = 'title' | 'excerpt' | 'content' | 'category' | 'cover_alt' | 'seo_title' | 'seo_description';

const CATEGORIES: Record<string, string> = {
  Visage: 'Face', Regard: 'Brows & lashes', Corps: 'Body', Cheveux: 'Hair', Ongles: 'Nails', 'Conseils beauté': 'Beauty tips', Nouveautés: 'News',
};

@Component({
  selector: 'app-admin-blog',
  imports: [FormsModule, AdmIconComponent, StatusComponent, PostContentComponent, ADMIN_I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (draft(); as d) {
      <div class="adm-page-head">
        <div>
          <h1>{{ (d.id ? 'Modifier l’article' : 'Nouvel article') | tr }}</h1>
          <p class="adm-muted">{{ 'Un article = une page de plus sur Google. Choisissez un sujet que vos clientes recherchent (un soin + Marrakech) et soyez concrète.' | tr }}</p>
        </div>
        <div class="adm-actions" style="margin: 0">
          <button type="button" class="adm-btn" (click)="close()">← {{ 'Tous les articles' | tr }}</button>
          @if (d.id && d.status === 'published') {
            <a class="adm-btn" [href]="(edit.en() && hasEn(d) ? '/en/blog/' : '/blog/') + d.slug" target="_blank" rel="noopener"><app-adm-icon name="eye" /> {{ 'Voir l’article' | tr }}</a>
          }
        </div>
      </div>

      <app-edit-lang note="L’article est publié en anglais (/en/blog/…) dès que son titre et son texte anglais sont remplis. Sinon, le site anglais renvoie vers la version française." />

      <div class="adm-editor">
        <form class="adm-card" (ngSubmit)="save()">
          <label>{{ 'Titre' | tr }} <em>({{ val(d, 'title').length }}/160)</em>
            <input data-tr name="title" [ngModel]="val(d, 'title')" (ngModelChange)="setVal(d, 'title', $event); autoSlug(d)" maxlength="160"
              [placeholder]="edit.ph(d, 'title', 'ex. Massage relaxant : tout savoir avant votre premier soin' | tr)" />
          </label>
          <div class="adm-row2">
            <label>{{ 'Adresse de la page' | tr }} <em>opaalbeautyclub.com{{ edit.en() ? '/en' : '' }}/blog/{{ d.slug || '…' }}</em>
              <input name="slug" [(ngModel)]="d.slug" (ngModelChange)="d.slugTouched = true" placeholder="massage-relaxant" />
            </label>
            <label>{{ 'Catégorie' | tr }}
              <input data-tr name="category" list="blog-cats" [ngModel]="val(d, 'category')" (ngModelChange)="setVal(d, 'category', $event)"
                [placeholder]="edit.ph(d, 'category', 'ex. Visage, Massages, Conseils beauté' | tr)" maxlength="60" />
            </label>
          </div>
          <datalist id="blog-cats">@for (c of categories(); track c) {<option [value]="c"></option>}</datalist>

          <div class="adm-cover">
            @if (d.cover) {<img [src]="d.cover" [alt]="d.cover_alt" />} @else {<div class="adm-cover-empty"><app-adm-icon name="image" /></div>}
            <div>
              <label>{{ 'Image de couverture' | tr }} <em>{{ '(affichée en haut et dans les partages)' | tr }}</em></label>
              <div class="adm-actions" style="margin: 0 0 10px">
                <button type="button" class="adm-btn sm primary" (click)="pickCover(d)"><app-adm-icon name="image" /> {{ (d.cover ? 'Changer' : 'Choisir une image') | tr }}</button>
                @if (d.cover) {<button type="button" class="adm-btn sm" (click)="d.cover = ''; d.cover_alt = ''; d.cover_alt_en = ''">{{ 'Retirer' | tr }}</button>}
              </div>
              <input data-tr name="cover_alt" [ngModel]="val(d, 'cover_alt')" (ngModelChange)="setVal(d, 'cover_alt', $event)"
                [placeholder]="edit.ph(d, 'cover_alt', 'Description de l’image (texte alternatif)' | tr)" maxlength="160" [attr.aria-label]="'Texte alternatif de l’image' | tr" />
            </div>
          </div>

          <label>{{ 'Résumé' | tr }} <em>({{ val(d, 'excerpt').length }}/320 — {{ 'affiché sur la liste des articles' | tr }})</em>
            <textarea data-tr name="excerpt" class="autogrow" rows="2" maxlength="320" [ngModel]="val(d, 'excerpt')" (ngModelChange)="setVal(d, 'excerpt', $event)" [placeholder]="edit.ph(d, 'excerpt')"></textarea>
          </label>

          <label>{{ 'Texte de l’article' | tr }}</label>
          <div class="adm-toolbar-md" role="toolbar" [attr.aria-label]="'Mise en forme' | tr">
            <button type="button" (click)="wrap('## ', '', i18n.tr('Intertitre'))">{{ 'Intertitre' | tr }}</button>
            <button type="button" (click)="wrap('**', '**', i18n.tr('texte en gras'))"><b>{{ 'Gras' | tr }}</b></button>
            <button type="button" (click)="wrap('- ', '', i18n.tr('élément de liste'))">• {{ 'Liste' | tr }}</button>
            <button type="button" (click)="link()">{{ 'Lien' | tr }}</button>
            <button type="button" (click)="insertImage()"><app-adm-icon name="image" /> {{ 'Image' | tr }}</button>
          </div>
          <textarea data-tr #body name="content" rows="18" class="adm-md" [ngModel]="val(d, 'content')" (ngModelChange)="setVal(d, 'content', $event)"
            [placeholder]="edit.en() ? ('Écrivez ici la version anglaise de l’article… (vide = article non traduit)' | tr) : ('Écrivez votre article… Une ligne vide sépare les paragraphes.' | tr)"></textarea>
          <p class="adm-hint">{{ '« ## » = intertitre · « - » = liste · **gras** · [texte](/soins) = lien vers une page du site.' | tr }}
            {{ '{w} mots · environ {m} min de lecture.' | tr: { w: words(val(d, 'content')), m: minutes(val(d, 'content')) } }}
            @if (edit.en()) { {{ 'Liens vers le site anglais : [texte](/en/soins).' | tr }} }
          </p>

          <h2 class="adm-h3">{{ 'Référencement Google' | tr }}</h2>
          <div class="adm-seo-grid">
            <div>
              <label>{{ 'Titre Google' | tr }} <em [class.warn]="(val(d, 'seo_title') || val(d, 'title')).length > 60">{{ (val(d, 'seo_title') || val(d, 'title')).length }}/60</em>
                <input data-tr name="seo_title" [ngModel]="val(d, 'seo_title')" (ngModelChange)="setVal(d, 'seo_title', $event)" [placeholder]="val(d, 'title')" maxlength="120" />
              </label>
              <label>{{ 'Description Google' | tr }} <em [class.warn]="(val(d, 'seo_description') || val(d, 'excerpt')).length > 160">{{ (val(d, 'seo_description') || val(d, 'excerpt')).length }}/160</em>
                <textarea data-tr name="seo_description" rows="3" [ngModel]="val(d, 'seo_description')" (ngModelChange)="setVal(d, 'seo_description', $event)" [placeholder]="val(d, 'excerpt')" maxlength="320"></textarea>
              </label>
            </div>
            <div class="adm-serp">
              <small>{{ 'Aperçu Google' | tr }}</small>
              <span class="u">opaalbeautyclub.com{{ edit.en() ? ' › en' : '' }} › blog › {{ d.slug }}</span>
              <b>{{ cut(val(d, 'seo_title') || val(d, 'title') || ('Titre de l’article' | tr), 60) }}</b>
              <p>{{ cut(val(d, 'seo_description') || val(d, 'excerpt') || ('Description de l’article…' | tr), 160) }}</p>
            </div>
          </div>

          <div class="adm-row2" style="margin-top: 10px">
            <label>{{ 'Statut' | tr }}
              <select name="status" [(ngModel)]="d.status">
                <option value="draft">{{ 'Brouillon (invisible sur le site)' | tr }}</option>
                <option value="published">{{ 'Publié' | tr }}</option>
              </select>
            </label>
            <label>{{ 'Date de publication' | tr }} <em>{{ '(vide = aujourd’hui ; une date future programme l’article)' | tr }}</em>
              <input name="date" type="date" [(ngModel)]="d.published_at" />
            </label>
          </div>
          <div class="adm-actions">
            <button class="adm-btn primary" type="submit" [disabled]="busy()">{{ (busy() ? 'Enregistrement…' : (d.status === 'published' ? 'Enregistrer et publier' : 'Enregistrer le brouillon')) | tr }}</button>
            @if (d.id) {<button type="button" class="adm-btn danger" (click)="remove(d)"><app-adm-icon name="trash" /> {{ 'Supprimer' | tr }}</button>}
          </div>
        </form>

        <section class="adm-card adm-post-preview">
          <header class="adm-card-head"><h2>{{ 'Aperçu' | tr }}</h2><span class="adm-muted">{{ 'tel qu’il apparaîtra' | tr }}@if (edit.en()) { · English}</span></header>
          <div class="post-body preview">
            @if (d.cover) {<img class="preview-cover" [src]="d.cover" [alt]="shown(d, 'cover_alt')" />}
            <p class="blog-meta">{{ shown(d, 'category') || ('Catégorie' | tr) }} · {{ '{n} min de lecture' | tr: { n: minutes(shown(d, 'content')) } }}</p>
            <h1>{{ shown(d, 'title') || ('Titre de l’article' | tr) }}</h1>
            @if (shown(d, 'excerpt')) {<p class="post-lead">{{ shown(d, 'excerpt') }}</p>}
            <app-post-content [text]="shown(d, 'content')" />
          </div>
        </section>
      </div>
    } @else {
      <div class="adm-page-head">
        <div>
          <h1>{{ 'Blog' | tr }}</h1>
          <p class="adm-muted">{{ 'Des articles utiles et réguliers (1 à 2 par mois) font venir de nouvelles clientes depuis Google. Chaque article publié devient une page du site, ajoutée automatiquement au plan du site.' | tr }}</p>
        </div>
        <button type="button" class="adm-btn primary" (click)="open(null)"><app-adm-icon name="plus" /> {{ 'Nouvel article' | tr }}</button>
      </div>
      @if (loading()) {
        <div class="adm-loading"><span></span><span></span><span></span></div>
      } @else if (!posts().length) {
        <p class="adm-empty">{{ 'Aucun article pour le moment.' | tr }}</p>
      }
      <div class="adm-posts">
        @for (p of posts(); track p.id) {
          <article class="adm-post">
            <img [src]="p.cover || 'images/og-opaal.jpg'" [alt]="p.cover_alt" loading="lazy" />
            <div>
              <app-status [value]="p.status === 'published' ? 'approved' : 'pending'" [label]="p.status === 'published' ? (isFuture(p) ? programmed : publishedLabel) : draftLabel" />
              @if (p.has_en) {<app-lang-badge lang="en" />} @else {<span class="adm-pill">{{ 'Pas encore traduit' | tr }}</span>}
              <h3>{{ i18n.lang() === 'en' && p.title_en ? p.title_en : p.title }}</h3>
              <p class="adm-muted">{{ (i18n.lang() === 'en' && p.category_en ? p.category_en : p.category) || ('Sans catégorie' | tr) }} · {{ p.published_at ? shortDate(p.published_at) : ('non publié' | tr) }} · {{ p.reading_time }} min</p>
              <p class="adm-post-excerpt">{{ i18n.lang() === 'en' && p.excerpt_en ? p.excerpt_en : p.excerpt }}</p>
            </div>
            <div class="adm-actions" style="margin: 0; align-self: center">
              <button type="button" class="adm-btn sm" (click)="open(p)">{{ 'Modifier' | tr }}</button>
              @if (p.status === 'draft') {<button type="button" class="adm-btn sm primary" (click)="publish(p)">{{ 'Publier' | tr }}</button>}
              @if (p.status === 'published') {<a class="adm-btn sm" [href]="'/blog/' + p.slug" target="_blank" rel="noopener"><app-adm-icon name="eye" /></a>}
            </div>
          </article>
        }
      </div>
    }
  `,
})
export class BlogAdminPage {
  private readonly api = inject(AdminApi);
  private readonly toaster = inject(Toaster);
  private readonly picker = inject(MediaPicker);
  protected readonly i18n = inject(I18nService);
  protected readonly edit = inject(EditLang);
  private readonly body = viewChild<ElementRef<HTMLTextAreaElement>>('body');
  protected readonly shortDate = shortDate;
  protected readonly programmed = mark('Programmé');
  protected readonly publishedLabel = mark('Publié');
  protected readonly draftLabel = mark('Brouillon');
  protected readonly posts = signal<BlogPost[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly categories = computed(() => {
    const en = this.edit.en();
    const base = en ? Object.values(CATEGORIES) : Object.keys(CATEGORIES);
    const used = this.posts().map((p) => (en ? p.category_en ?? '' : p.category)).filter(Boolean);
    return [...new Set([...base, ...used])];
  });

  constructor() {
    void this.load();
  }

  /** Valeur d'un champ dans la langue modifiée. */
  protected val(d: Draft, f: TextField): string {
    return this.edit.get(d, f);
  }

  protected setVal(d: Draft, f: TextField, v: string): void {
    this.edit.set_(d, f, v);
  }

  /** Aperçu : en anglais, champ anglais sinon texte français. */
  protected shown(d: Draft, f: TextField): string {
    return this.edit.en() ? this.val(d, f) || d[f] : d[f];
  }

  protected hasEn(d: Draft): boolean {
    return !!d.title_en.trim() && !!d.content_en.trim();
  }

  private async load(): Promise<void> {
    try {
      this.posts.set(await this.api.posts());
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected isFuture(p: BlogPost): boolean {
    return !!p.published_at && new Date(p.published_at.replace(' ', 'T')) > new Date();
  }

  protected async open(p: BlogPost | null): Promise<void> {
    if (!p) {
      this.draft.set(empty());
      return;
    }
    try {
      const full = await this.api.post(p.id);
      this.draft.set({
        id: full.id, title: full.title, slug: full.slug, excerpt: full.excerpt, content: full.content ?? '', category: full.category,
        cover: full.cover, cover_alt: full.cover_alt, seo_title: full.seo_title, seo_description: full.seo_description,
        status: full.status, published_at: full.published_at?.slice(0, 10) ?? '', slugTouched: true,
        title_en: full.title_en ?? '', excerpt_en: full.excerpt_en ?? '', content_en: full.content_en ?? '', category_en: full.category_en ?? '',
        cover_alt_en: full.cover_alt_en ?? '', seo_title_en: full.seo_title_en ?? '', seo_description_en: full.seo_description_en ?? '',
      });
      window.scrollTo({ top: 0 });
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected close(): void {
    this.draft.set(null);
    void this.load();
  }

  /** Adresse de la page tirée du titre français (commune aux deux langues). */
  protected autoSlug(d: Draft): void {
    if (!d.slugTouched && !d.id && !this.edit.en()) d.slug = slugify(d.title);
  }

  protected async pickCover(d: Draft): Promise<void> {
    const img = await this.picker.open(this.i18n.tr('Image de couverture'));
    if (img) {
      d.cover = img.src;
      if (!d.cover_alt) d.cover_alt = img.alt;
      this.draft.update((x) => (x ? { ...x } : x));
    }
  }

  /** Insère une mise en forme autour de la sélection du texte (dans la langue modifiée). */
  protected wrap(before: string, after: string, placeholder: string): void {
    const d = this.draft();
    const ta = this.body()?.nativeElement;
    if (!d || !ta) return;
    const content = this.val(d, 'content');
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = content.slice(start, end) || placeholder;
    const lineStart = before.endsWith(' ') && start > 0 && content[start - 1] !== '\n' ? '\n\n' : '';
    const insert = lineStart + before + sel + after;
    this.setVal(d, 'content', content.slice(0, start) + insert + content.slice(end));
    this.draft.set({ ...d });
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + lineStart.length + before.length, start + lineStart.length + before.length + sel.length);
    });
  }

  protected link(): void {
    const def = this.edit.en() ? '/en/soins' : '/soins';
    const url = prompt(this.i18n.tr('Adresse du lien (ex. {path} ou https://…) :', { path: def }), def);
    if (url) this.wrap('[', `](${url.trim()})`, this.i18n.tr('texte du lien'));
  }

  protected async insertImage(): Promise<void> {
    const d = this.draft();
    const ta = this.body()?.nativeElement;
    if (!d) return;
    const img = await this.picker.open(this.i18n.tr('Insérer une image dans l’article'));
    if (!img) return;
    const content = this.val(d, 'content');
    const pos = ta?.selectionStart ?? content.length;
    const code = `\n\n![${(img.alt || 'Photo OPAAL').replace(/[\[\]]/g, '')}](${img.src})\n\n`;
    this.setVal(d, 'content', (content.slice(0, pos) + code + content.slice(pos)).replace(/\n{3,}/g, '\n\n'));
    this.draft.set({ ...d });
  }

  protected words(t: string): number {
    return (t.match(/[\p{L}\d’'-]+/gu) ?? []).length;
  }

  protected minutes(t: string): number {
    return Math.max(1, Math.ceil(this.words(t) / 200));
  }

  protected cut(s: string, n: number): string {
    return [...s].length > n ? [...s].slice(0, n - 1).join('') + '…' : s;
  }

  private input(d: Draft): PostInput {
    return {
      title: d.title, slug: d.slug, excerpt: d.excerpt, content: d.content, category: d.category, cover: d.cover, cover_alt: d.cover_alt,
      seo_title: d.seo_title, seo_description: d.seo_description, status: d.status, published_at: d.published_at,
      title_en: d.title_en, excerpt_en: d.excerpt_en, content_en: d.content_en, category_en: d.category_en, cover_alt_en: d.cover_alt_en,
      seo_title_en: d.seo_title_en, seo_description_en: d.seo_description_en,
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
      const saved = d.id ? await this.api.updatePost(d.id, this.input(d)) : await this.api.createPost(this.input(d));
      this.draft.set({ ...d, id: saved.id, slug: saved.slug, published_at: saved.published_at?.slice(0, 10) ?? '', slugTouched: true });
      if (saved.status !== 'published') {
        this.toaster.ok(this.i18n.tr('Brouillon enregistré.'));
      } else {
        this.toaster.ok(this.i18n.tr(saved.has_en ? 'Article publié sur le site (français et anglais).' : 'Article publié sur le site.'));
      }
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async publish(p: BlogPost): Promise<void> {
    try {
      const full = await this.api.post(p.id);
      await this.api.updatePost(p.id, {
        title: full.title, slug: full.slug, excerpt: full.excerpt, content: full.content ?? '', category: full.category, cover: full.cover,
        cover_alt: full.cover_alt, seo_title: full.seo_title, seo_description: full.seo_description, status: 'published', published_at: '',
        title_en: full.title_en ?? '', excerpt_en: full.excerpt_en ?? '', content_en: full.content_en ?? '', category_en: full.category_en ?? '',
        cover_alt_en: full.cover_alt_en ?? '', seo_title_en: full.seo_title_en ?? '', seo_description_en: full.seo_description_en ?? '',
      });
      this.toaster.ok(this.i18n.tr('« {title} » est publié.', { title: p.title }));
      await this.load();
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected async remove(d: Draft): Promise<void> {
    if (!d.id || !confirm(this.i18n.tr('Supprimer définitivement l’article « {title} » ?', { title: d.title }))) return;
    try {
      await this.api.deletePost(d.id);
      this.toaster.ok(this.i18n.tr('Article supprimé.'));
      this.close();
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }
}
