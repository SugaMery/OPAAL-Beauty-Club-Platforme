import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { errorMessage } from '../core/api.service';
import { ContentService } from '../core/content.service';
import { I18nService, mark } from '../core/i18n';
import { BlogPost, Category, Offer, Settings } from '../core/models';
import { AdminApi, Campaign } from './admin-api';
import { AdmIconComponent, Toaster } from './admin-shared';
import { ADMIN_I18N, EditLang } from './admin-i18n';

interface Progress {
  label: string;
  hint: string;
  done: number;
  total: number;
  link: string;
}

/** Langues du site : activer / désactiver l'anglais, langue de l'espace propriétaire, avancement des traductions. */
@Component({
  selector: 'app-admin-languages',
  imports: [AdmIconComponent, ADMIN_I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-page-head">
      <div>
        <h1>{{ 'Langues du site' | tr }}</h1>
        <p class="adm-muted">{{ 'Le site existe en français et en anglais. Choisissez les langues visibles par vos clientes et suivez l’avancement des traductions.' | tr }}</p>
      </div>
      <a class="adm-btn" href="/en" target="_blank" rel="noopener"><app-adm-icon name="eye" /> {{ 'Voir le site en anglais' | tr }}</a>
    </div>

    <div class="adm-grid-2 adm-grid-top">
      <section class="adm-card">
        <h2>{{ 'Langues publiées' | tr }}</h2>
        <div class="adm-langs">
          <div class="adm-lang-row on">
            <span class="code">FR</span>
            <div><strong>Français</strong><span>{{ 'Langue principale — toujours active (adresses habituelles : /soins, /contact…)' | tr }}</span></div>
            <span class="adm-pill ok">{{ 'Active' | tr }}</span>
          </div>
          <div class="adm-lang-row" [class.on]="english()">
            <span class="code">EN</span>
            <div>
              <strong>English</strong>
              <span>{{ (english() ? 'Visible sur le site (adresses en /en : /en/soins, /en/contact…) et dans Google.' : 'Masquée : le sélecteur FR | EN disparaît et les adresses /en renvoient vers les pages françaises.') | tr }}</span>
            </div>
            <label class="adm-switch" [attr.aria-label]="'Activer la version anglaise' | tr">
              <input type="checkbox" [checked]="english()" [disabled]="busy() || !loaded()" (change)="toggleEnglish($any($event.target))" /><i></i>
            </label>
          </div>
        </div>
        <p class="adm-hint" style="margin-top: 14px">{{ 'Vous pouvez préparer vos traductions avant d’activer l’anglais : rien n’est visible tant que la version anglaise est désactivée.' | tr }}</p>
      </section>

      <section class="adm-card">
        <h2>{{ 'Langue de l’espace propriétaire' | tr }}</h2>
        <p class="adm-muted">{{ 'Menus, boutons et messages de cet espace. Ce choix ne change rien au site : il est mémorisé sur cet appareil.' | tr }}</p>
        <app-admin-lang />
        <h3 class="adm-h3">{{ 'Comment ça marche' | tr }}</h3>
        <ul class="adm-help-list">
          <li>{{ 'En haut des pages de contenu, les onglets « Français / English » choisissent la version que vous modifiez.' | tr }}</li>
          <li>{{ 'Un champ anglais laissé vide affiche le texte français sur le site anglais : rien ne reste jamais vide.' | tr }}</li>
          <li>{{ 'Prix, photos, horaires d’ouverture (chiffres), liens et réglages sont communs aux deux langues.' | tr }}</li>
          <li>{{ 'Les e-mails automatiques partent dans la langue de la cliente ; ceux qui vous sont destinés, dans la langue de cet espace.' | tr }}</li>
        </ul>
      </section>
    </div>

    <section class="adm-card">
      <header class="adm-card-head">
        <h2>{{ 'Traductions anglaises' | tr }}</h2>
        @if (loaded()) {<span class="adm-muted">{{ '{done} / {total} textes traduits' | tr: { done: totalDone(), total: totalAll() } }}</span>}
      </header>
      @if (!loaded()) {
        <div class="adm-loading"><span></span><span></span><span></span></div>
      } @else {
        <p class="adm-muted">{{ 'Les textes fixes du site (menus, boutons, pages, e-mails) sont déjà traduits. Voici vos contenus modifiables :' | tr }}</p>
        <ul class="adm-tr-list">
          @for (p of progress(); track p.label) {
            <li>
              <div><strong>{{ p.label | tr }}</strong><small>{{ p.hint | tr: { done: p.done, total: p.total } }}</small></div>
              <div class="adm-tr-bar" [class.full]="p.done >= p.total"><i [style.width.%]="p.total ? (p.done / p.total) * 100 : 100"></i></div>
              <button type="button" class="adm-btn sm" [class.primary]="p.done < p.total" (click)="translate(p)">
                {{ (p.done < p.total ? 'Traduire' : 'Relire') | tr }} →
              </button>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class LanguagesPage {
  private readonly api = inject(AdminApi);
  private readonly toaster = inject(Toaster);
  private readonly content = inject(ContentService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly edit = inject(EditLang);

  protected readonly busy = signal(false);
  protected readonly loaded = signal(false);
  private readonly settings = signal<Settings | null>(null);
  private readonly catalog = signal<Category[]>([]);
  private readonly offers = signal<Offer[]>([]);
  private readonly posts = signal<BlogPost[]>([]);
  private readonly campaigns = signal<Campaign[]>([]);

  protected readonly english = computed(() => {
    const l = this.settings()?.languages;
    return !Array.isArray(l) || l.includes('en');
  });

  protected readonly progress = computed<Progress[]>(() => {
    const has = (v: string | undefined | null) => !!v && !!v.trim();
    const pair = (fr: string | undefined, en: string | undefined) => (has(fr) ? [has(en) ? 1 : 0, 1] : [0, 0]);
    const sum = (rows: number[][]) => rows.reduce((a, [d, t]) => [a[0] + d, a[1] + t], [0, 0]);
    const s = this.settings();
    const cats = this.catalog();
    const services = cats.flatMap((c) => c.services);
    const [catD, catT] = sum(cats.flatMap((c) => [pair(c.title, c.title_en), pair(c.intro, c.intro_en)]));
    const [svcD, svcT] = sum(services.flatMap((x) => [pair(x.name, x.name_en), pair(x.description, x.description_en)]));
    const [offD, offT] = sum(this.offers().flatMap((o) => [
      pair(o.title, o.title_en), pair(o.subtitle, o.subtitle_en), pair(o.description, o.description_en),
      pair(o.price, o.price_en), pair(o.badge, o.badge_en), [o.perks.length && o.perks_en?.length ? 1 : 0, o.perks.length ? 1 : 0],
    ]));
    const published = this.posts().filter((p) => p.status === 'published');
    const drafts = this.campaigns().filter((c) => c.status === 'draft');
    const [setD, setT] = s
      ? sum([
          pair(s.announcement, s.announcement_en), pair(s.country, s.country_en), pair(s.access_note ?? '', s.access_note_en),
          ...(s.hours ?? []).flatMap((h) => [pair(h.days, h.days_en), pair(h.time, h.time_en)]),
        ])
      : [0, 0];
    const images = s?.images && !Array.isArray(s.images) ? Object.values(s.images) : [];
    const [imgD, imgT] = sum([
      ...images.map((i) => pair(i.alt, i.alt_en)),
      ...(s?.gallery ?? []).map((g) => pair(g.caption, g.caption_en)),
      ...(s?.feed ?? []).map((g) => pair(g.caption, g.caption_en)),
    ]);
    const legalCustom = !!s?.legal?.length;
    return [
      { label: mark('Soins & tarifs'), hint: mark('{done} / {total} noms et descriptions de soins'), done: svcD, total: svcT, link: '/admin/tarifs' },
      { label: mark('Catégories de soins'), hint: mark('{done} / {total} titres et présentations'), done: catD, total: catT, link: '/admin/tarifs' },
      { label: mark('Offres & formules'), hint: mark('{done} / {total} textes'), done: offD, total: offT, link: '/admin/offres' },
      { label: mark('Articles du blog publiés'), hint: mark('{done} / {total} articles traduits'), done: published.filter((p) => p.has_en).length, total: published.length, link: '/admin/blog' },
      { label: mark('Coordonnées, horaires et annonce'), hint: mark('{done} / {total} textes'), done: setD, total: setT, link: '/admin/coordonnees' },
      { label: mark('Textes des photos et légendes'), hint: mark('{done} / {total} textes personnalisés'), done: imgD, total: imgT, link: '/admin/images' },
      {
        label: mark('Mentions légales & conditions'), hint: mark('{done} / {total} version anglaise enregistrée'),
        done: s?.legal_en?.length ? 1 : legalCustom ? 0 : 1, total: 1, link: '/admin/pages',
      },
      { label: mark('Newsletters en préparation'), hint: mark('{done} / {total} brouillons traduits'), done: drafts.filter((c) => has(c.subject_en) && has(c.body_en)).length, total: drafts.length, link: '/admin/newsletter' },
    ];
  });
  protected readonly totalDone = computed(() => this.progress().reduce((n, p) => n + Math.min(p.done, p.total), 0));
  protected readonly totalAll = computed(() => this.progress().reduce((n, p) => n + p.total, 0));

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [settings, catalog, offers, posts, campaigns] = await Promise.all([
        this.api.settings(), this.api.catalog(), this.api.offers(), this.api.posts(), this.api.campaigns(),
      ]);
      this.settings.set(settings);
      this.catalog.set(catalog);
      this.offers.set(offers);
      this.posts.set(posts);
      this.campaigns.set(campaigns);
      this.loaded.set(true);
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected async toggleEnglish(input: HTMLInputElement): Promise<void> {
    const on = input.checked;
    const q = on
      ? mark('Activer la version anglaise ? Le sélecteur FR | EN apparaîtra sur le site et les pages anglaises seront proposées à Google.')
      : mark('Désactiver la version anglaise ? Elle disparaîtra du site et de Google (vos traductions sont conservées).');
    if (!confirm(this.i18n.tr(q))) {
      input.checked = !on;
      return;
    }
    this.busy.set(true);
    try {
      const saved = await this.api.saveSettings({ languages: on ? ['fr', 'en'] : ['fr'] });
      this.settings.set(saved);
      this.content.load(true);
      this.toaster.ok(this.i18n.tr(on ? 'Version anglaise activée : le site est à jour.' : 'Version anglaise désactivée.'));
    } catch (e) {
      input.checked = !on;
      this.toaster.error(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  /** Ouvre la page à traduire directement sur l'onglet « English ». */
  protected translate(p: Progress): void {
    this.edit.set('en');
    void this.router.navigateByUrl(p.link);
  }
}
