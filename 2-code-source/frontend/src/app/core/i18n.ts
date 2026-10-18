import { DOCUMENT, Injectable, PLATFORM_ID, Pipe, PipeTransform, computed, effect, inject, signal } from '@angular/core';
import { Location, isPlatformBrowser } from '@angular/common';
import { Router, RoutesRecognized } from '@angular/router';
import { SITE_EN } from './i18n-site-en';

/**
 * Langues du site : le français (langue principale, adresses d'origine /soins…)
 * et l'anglais (adresses /en/soins…). Les textes sont écrits en français dans le code
 * et traduits par dictionnaire : {{ 'Réserver' | tr }}.
 * L'espace propriétaire a sa propre langue (préférence enregistrée sur l'appareil).
 */
export type Lang = 'fr' | 'en';
export const LANGS: readonly Lang[] = ['fr', 'en'];
export const LANG_NAMES: Record<Lang, string> = { fr: 'Français', en: 'English' };

const ADMIN_KEY = 'opaal-admin-lang';
const DICTS: Record<Lang, Record<string, string>> = { fr: {}, en: { ...SITE_EN } };
/** Langue affichée, pour le code sans injection (messages d'erreur) — navigateur uniquement. */
let active: Lang = 'fr';

/** Ajoute des traductions (ex. celles de l'espace propriétaire, chargées avec lui). */
export function registerTranslations(lang: Lang, dict: Record<string, string>): void {
  Object.assign(DICTS[lang], dict);
}

/** Contexte facultatif en tête de clé, pour un même mot traduit différemment : « [étape] Accueil ». */
const CONTEXT = /^\[[^\]]*\]\s*/;

/** Traduit un texte français ; « {nom} » est remplacé par vars.nom. Sans traduction : le texte français. */
export function translate(lang: Lang, fr: string, vars?: Record<string, string | number>): string {
  const base = fr.startsWith('[') ? fr.replace(CONTEXT, '') : fr;
  const s = lang === 'fr' ? base : (DICTS[lang][fr] ?? base);
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/** Langue affichée (code hors composants). */
export function activeLang(): Lang {
  return active;
}

/** Traduit dans la langue affichée (code hors composants : messages d'erreur, confirmations). */
export function trActive(fr: string, vars?: Record<string, string | number>): string {
  return translate(active, fr, vars);
}

/** Marque un texte comme traduisible : il est traduit à l'affichage ({{ texte | tr }}). */
export const mark = (fr: string): string => fr;

/** Vrai si le texte a une traduction dans le dictionnaire. */
export function hasTranslation(lang: Lang, fr: string): boolean {
  return lang === 'fr' || fr in DICTS[lang];
}

export function langOfPath(path: string): Lang {
  return /^\/en(?=[/?#]|$)/.test(path) ? 'en' : 'fr';
}

/** « /en/soins » → « /soins » */
export function stripLang(path: string): string {
  const p = path.replace(/^\/en(?=[/?#]|$)/, '');
  return p === '' ? '/' : p.startsWith('/') ? p : '/' + p;
}

/** Adresse d'une page dans une langue : « /soins » → « /en/soins », « / » → « /en ». */
export function localizePath(path: string, lang: Lang): string {
  const base = stripLang(path || '/');
  if (lang === 'fr') return base;
  return base === '/' ? '/en' : /^\/[?#]/.test(base) ? '/en' + base.slice(1) : '/en' + base;
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly url = signal(inject(Location).path() || '/');

  /** Langue de l'espace propriétaire (enregistrée sur cet appareil). */
  readonly adminLang = signal<Lang>(this.readAdminLang());
  /** Langue du site public, d'après l'adresse. */
  readonly siteLang = computed(() => langOfPath(this.url()));
  readonly isAdmin = computed(() => /^\/admin(?=[/?#]|$)/.test(this.url()));
  /** Langue affichée : celle du site, ou celle de l'espace propriétaire sur /admin. */
  readonly lang = computed<Lang>(() => (this.isAdmin() ? this.adminLang() : this.siteLang()));
  readonly locale = computed(() => (this.lang() === 'en' ? 'en-GB' : 'fr-FR'));

  constructor() {
    active = this.lang();
    this.doc.documentElement.setAttribute('lang', this.lang());
    inject(Router).events.subscribe((e) => {
      if (e instanceof RoutesRecognized) {
        this.url.set(e.urlAfterRedirects);
        active = this.lang();
        this.doc.documentElement.setAttribute('lang', active);
      }
    });
    effect(() => {
      active = this.lang();
      this.doc.documentElement.setAttribute('lang', active);
    });
  }

  tr(fr: string, vars?: Record<string, string | number>): string {
    return translate(this.lang(), fr, vars);
  }

  /** Adresse d'une page du site dans la langue du site affiché. */
  path(frPath: string): string {
    return localizePath(frPath, this.siteLang());
  }

  setAdminLang(lang: Lang): void {
    this.adminLang.set(lang);
    active = this.lang();
    if (this.isBrowser) {
      try {
        localStorage.setItem(ADMIN_KEY, lang);
      } catch {
        /* stockage indisponible */
      }
    }
  }

  private readAdminLang(): Lang {
    if (!this.isBrowser) return 'fr';
    try {
      const v = localStorage.getItem(ADMIN_KEY);
      if (v === 'fr' || v === 'en') return v;
    } catch {
      /* ignore */
    }
    return 'fr';
  }
}

/** Traduit un texte français dans la langue affichée ; variables : tr: { n: 3 } pour « {n} avis ». */
@Pipe({ name: 'tr', pure: false })
export class TrPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(fr: string, vars?: Record<string, string | number>): string {
    return this.i18n.tr(fr, vars);
  }
}

/** [routerLink]="'/soins' | lp" → /soins ou /en/soins selon la langue du site. */
@Pipe({ name: 'lp', pure: false })
export class LocalPathPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(frPath: string): string {
    return this.i18n.path(frPath);
  }
}

export const I18N = [TrPipe, LocalPathPipe] as const;
