import { ChangeDetectionStrategy, Component, Injectable, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18N, I18nService, Lang, registerTranslations } from '../core/i18n';
import { ContentService } from '../core/content.service';
import { ADMIN_EN } from './i18n-admin-en';

// Traductions anglaises de l'espace propriétaire (chargées avec lui, jamais sur le site public)
registerTranslations('en', ADMIN_EN);

/**
 * Langue du contenu en cours de modification (Français / English), commune à toutes les pages.
 * En anglais, les champs traduisibles modifient la version anglaise (champ « …_en »)
 * et affichent le texte français en gris comme modèle.
 */
@Injectable({ providedIn: 'root' })
export class EditLang {
  readonly lang = signal<Lang>('fr');
  readonly en = computed(() => this.lang() === 'en');

  set(lang: Lang): void {
    this.lang.set(lang);
  }

  /** Nom du champ dans la langue modifiée : « name » ou « name_en ». */
  key(field: string): string {
    return this.en() ? field + '_en' : field;
  }

  get(obj: object, field: string): string {
    const v = (obj as Record<string, unknown>)[this.key(field)];
    return typeof v === 'string' ? v : v == null ? '' : String(v);
  }

  set_(obj: object, field: string, value: string): void {
    (obj as Record<string, unknown>)[this.key(field)] = value;
  }

  /** En anglais : texte français affiché en modèle dans le champ vide. */
  ph(obj: object, field: string, fallback = ''): string {
    if (!this.en()) return fallback;
    const v = (obj as Record<string, unknown>)[field];
    return typeof v === 'string' && v.trim() ? v : fallback;
  }
}

/** Choix de la langue de l'espace propriétaire (menus, boutons, messages). */
@Component({
  selector: 'app-admin-lang',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [I18N],
  template: `
    <div class="adm-lang" role="group" [attr.aria-label]="'Langue de l’espace propriétaire' | tr" [class.light]="light()">
      <button type="button" [class.on]="i18n.adminLang() === 'fr'" [attr.aria-pressed]="i18n.adminLang() === 'fr'" lang="fr" title="Français" (click)="i18n.setAdminLang('fr')">FR</button>
      <button type="button" [class.on]="i18n.adminLang() === 'en'" [attr.aria-pressed]="i18n.adminLang() === 'en'" lang="en" title="English" (click)="i18n.setAdminLang('en')">EN</button>
    </div>
  `,
})
export class AdminLangComponent {
  readonly light = input(false);
  protected readonly i18n = inject(I18nService);
}

/** Onglets « Français / English » au-dessus des contenus modifiables. */
@Component({
  selector: 'app-edit-lang',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [I18N, RouterLink],
  template: `
    <div class="adm-edit-lang" [class.is-en]="edit.en()">
      <div class="adm-edit-tabs" role="tablist" [attr.aria-label]="'Version du site à modifier' | tr">
        <span class="lbl">{{ 'Version du site' | tr }}</span>
        <button type="button" role="tab" [attr.aria-selected]="!edit.en()" [class.on]="!edit.en()" (click)="edit.set('fr')"><b>FR</b> Français</button>
        <button type="button" role="tab" [attr.aria-selected]="edit.en()" [class.on]="edit.en()" (click)="edit.set('en')"><b>EN</b> English</button>
      </div>
      @if (edit.en()) {
        <p class="adm-edit-hint">
          {{ 'Vous modifiez la version anglaise du site. Un champ laissé vide affiche le texte français (en gris).' | tr }}
          @if (note()) {<br />{{ note() | tr }}}
          @if (!content.englishEnabled()) {
            <br /><b>{{ 'La version anglaise est désactivée : les visiteurs ne la voient pas encore.' | tr }}</b>
            <a routerLink="/admin/langues">{{ 'Activer l’anglais' | tr }} →</a>
          }
        </p>
      }
    </div>
  `,
})
export class EditLangComponent {
  /** Précision propre à la page (facultatif). */
  readonly note = input('');
  protected readonly edit = inject(EditLang);
  protected readonly content = inject(ContentService);
}

/** Petite étiquette « EN » / « FR » (langue d'un message, d'une abonnée…). */
@Component({
  selector: 'app-lang-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [I18N],
  template: `<span class="adm-lang-badge" [class.en]="lang() === 'en'" [attr.title]="(lang() === 'en' ? 'Anglais' : 'Français') | tr">{{ lang().toUpperCase() }}</span>`,
})
export class LangBadgeComponent {
  readonly lang = input<string>('fr');
}

export const ADMIN_I18N = [...I18N, EditLangComponent, AdminLangComponent, LangBadgeComponent] as const;
