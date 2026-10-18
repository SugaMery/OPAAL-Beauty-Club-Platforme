import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../core/api.service';
import { I18nService, mark } from '../core/i18n';
import { ContentService } from '../core/content.service';
import { AdminApi, Dashboard } from './admin-api';
import { AdmIconComponent, MESSAGE_LABELS, StatusComponent, Toaster, dayName, shortDate, when } from './admin-shared';
import { ADMIN_I18N, LangBadgeComponent } from './admin-i18n';

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, AdmIconComponent, StatusComponent, ADMIN_I18N, LangBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-hello">
      <div>
        <p class="adm-eyebrow">{{ today() }}</p>
        <h1>{{ 'Bonjour, bienvenue dans votre espace' | tr }}</h1>
        <p class="adm-muted">{{ 'Suivez l’activité du site, répondez aux messages, envoyez vos newsletters et mettez à jour vos pages en quelques clics.' | tr }}</p>
      </div>
      <a class="adm-btn" href="/" target="_blank" rel="noopener"><app-adm-icon name="eye" /> {{ 'Voir le site' | tr }}</a>
    </div>

    @if (data(); as d) {
      <div class="adm-stats">
        <a class="adm-stat" routerLink="/admin/coordonnees">
          <app-adm-icon name="calendar" /><b>{{ d.counts.booking_clicks_7 }}</b><span>{{ 'Clics « Réserver »' | tr }}</span>
          <small>{{ '7 derniers jours · {n} sur 30 jours' | tr: { n: d.counts.booking_clicks_30 } }}</small>
        </a>
        <a class="adm-stat" routerLink="/admin/messages">
          <app-adm-icon name="mail" /><b>{{ d.counts.messages_new }}</b><span>{{ 'Messages non lus' | tr }}</span>
          <small>{{ '{n} messages au total' | tr: { n: d.counts.messages_total } }}</small>
        </a>
        <a class="adm-stat" routerLink="/admin/avis">
          <app-adm-icon name="star" /><b>{{ d.counts.reviews_pending }}</b><span>{{ 'Avis à valider' | tr }}</span>
          <small>{{ '{n} avis publiés' | tr: { n: d.counts.reviews_approved } }}</small>
        </a>
        <a class="adm-stat" routerLink="/admin/newsletter">
          <app-adm-icon name="users" /><b>{{ d.counts.subscribers }}</b><span>{{ 'Abonnées newsletter' | tr }}</span>
          <small>{{ '+{n} sur 30 jours' | tr: { n: d.counts.subscribers_30 } }}</small>
        </a>
      </div>

      <div class="adm-grid-2">
        <section class="adm-card">
          <header class="adm-card-head"><h2>{{ 'Clics vers l’agenda en ligne' | tr }}</h2><span class="adm-muted">{{ '14 derniers jours' | tr }}</span></header>
          <p class="adm-muted">{{ 'Nombre de clics sur les boutons « Réserver » du site (vers Dikidi). {n} demande(s) « Devenir membre » sur WhatsApp en 30 jours.' | tr: { n: d.counts.whatsapp_clicks_30 } }}</p>
          <div class="adm-bars" role="img" [attr.aria-label]="chartLabel()">
            @for (b of bars(); track b.date) {
              <div class="adm-bar" [attr.data-tip]="b.tip" tabindex="0">
                <i [style.height.%]="b.h" [class.zero]="!b.count"></i>
                <span [class.today]="b.today">{{ b.day }}</span>
              </div>
            }
          </div>
          @if (d.top_booked.length) {
            <h3 class="adm-h3">{{ 'Les plus cliqués (30 jours)' | tr }}</h3>
            <ul class="adm-toplist">
              @for (t of d.top_booked; track t.label) {<li><span>{{ t.label }}</span><b>{{ t.n }}</b></li>}
            </ul>
          }
        </section>

        <section class="adm-card">
          <header class="adm-card-head"><h2>{{ 'Derniers messages' | tr }}</h2><a routerLink="/admin/messages">{{ 'Tout voir' | tr }} →</a></header>
          @if (d.messages.length) {
            <ul class="adm-list">
              @for (m of d.messages; track m.id) {
                <li>
                  <a routerLink="/admin/messages" [queryParams]="{ id: m.id }">
                    <div><strong>{{ m.name }} @if (m.lang === 'en') {<app-lang-badge lang="en" />}</strong><span>{{ m.subject ? (m.subject | tr) : ('Message' | tr) }} · {{ when(m.created_at) }}</span></div>
                    <app-status [value]="m.status" [label]="msgLabels[m.status]" />
                  </a>
                </li>
              }
            </ul>
          } @else {
            <p class="adm-empty">{{ 'Aucun message pour le moment.' | tr }}</p>
          }
        </section>
      </div>

      <div class="adm-grid-2">
        <section class="adm-card">
          <header class="adm-card-head"><h2>{{ 'À faire' | tr }}</h2><span class="adm-muted">{{ '{done}/{total} terminé' | tr: { done: doneCount(), total: todo().length } }}</span></header>
          <ul class="adm-todo">
            @for (t of todo(); track t.label) {
              <li [class.done]="t.done">
                <span class="tick" aria-hidden="true">@if (t.done) {<app-adm-icon name="check" />}</span>
                <div><strong>{{ t.label | tr }}</strong><span>{{ t.hint | tr: t.vars }}</span></div>
                @if (!t.done) {<a class="adm-btn sm" [routerLink]="t.link">{{ t.action | tr }}</a>}
              </li>
            }
          </ul>
        </section>
        <section class="adm-card">
          <header class="adm-card-head"><h2>{{ 'Envoi des e-mails' | tr }}</h2><a routerLink="/admin/emails">{{ 'Réglages' | tr }} →</a></header>
          @if (d.mail_log.length) {
            <ul class="adm-log">
              @for (l of d.mail_log; track $index) {
                <li [class.fail]="l.status !== 'envoye'">
                  <span class="dot"></span>
                  <div><strong>{{ l.subject }}</strong><span>{{ l.to_addr }} · {{ when(l.created_at) }}</span>
                    @if (l.error) {<em>{{ l.error }}</em>}
                  </div>
                </li>
              }
            </ul>
          } @else {
            <p class="adm-empty">{{ 'Aucun e-mail envoyé pour le moment. Faites un essai depuis « E-mails (SMTP) ».' | tr }}</p>
          }
          <div class="adm-shortcuts" style="margin-top: 18px">
            <a routerLink="/admin/newsletter"><app-adm-icon name="send" /><span>{{ 'Nouvelle newsletter' | tr }}</span></a>
            <a routerLink="/admin/tarifs"><app-adm-icon name="tag" /><span>{{ 'Modifier les tarifs' | tr }}</span></a>
            <a routerLink="/admin/offres"><app-adm-icon name="gift" /><span>{{ 'Offres & formules' | tr }}</span></a>
            <a routerLink="/admin/langues"><app-adm-icon name="lang" /><span>{{ 'Langues du site' | tr }}</span></a>
          </div>
        </section>
      </div>
    } @else if (error()) {
      <p class="adm-error">{{ error() }}</p>
    } @else {
      <div class="adm-loading"><span></span><span></span><span></span></div>
    }
  `,
})
export class DashboardPage {
  private readonly api = inject(AdminApi);
  private readonly i18n = inject(I18nService);
  private readonly content = inject(ContentService);
  protected readonly toaster = inject(Toaster);
  protected readonly data = signal<Dashboard | null>(null);
  protected readonly error = signal('');
  protected readonly msgLabels = MESSAGE_LABELS;
  protected readonly shortDate = shortDate;
  protected readonly when = when;
  protected readonly today = computed(() =>
    new Date().toLocaleDateString(this.i18n.locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  );

  protected readonly bars = computed(() => {
    this.i18n.lang(); // jours et bulles dans la langue choisie
    const days = this.data()?.booking_days ?? [];
    const max = Math.max(1, ...days.map((d) => d.count));
    const t = new Date();
    const todayIso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    return days.map((d) => {
      const date = new Date(d.date + 'T12:00:00');
      return {
        date: d.date,
        count: d.count,
        h: d.count ? Math.max(6, (d.count / max) * 100) : 0,
        day: dayName(date.getDay()).slice(0, 2),
        today: d.date === todayIso,
        tip: this.i18n.tr(d.count > 1 ? '{date} : {n} clics' : '{date} : {n} clic', { date: shortDate(d.date), n: d.count }),
      };
    });
  });
  protected readonly chartLabel = computed(() =>
    this.i18n.tr('Clics sur Réserver par jour : {list}', { list: this.bars().map((b) => b.tip).join(', ') }),
  );

  protected readonly todo = computed(() => {
    const c = this.data()?.checklist;
    if (!c) return [];
    const drafts = { n: this.data()?.counts.posts_draft ?? 0 };
    return [
      { done: c.password_changed, label: mark('Choisir votre mot de passe'), hint: mark('Remplacez le mot de passe initial.'), vars: {}, link: '/admin/compte', action: mark('Changer') },
      { done: c.email_ok, label: mark('Vérifier l’envoi des e-mails'), hint: mark('Envoyez un e-mail de test à votre adresse.'), vars: {}, link: '/admin/emails', action: mark('Tester') },
      { done: c.prices, label: mark('Renseigner vos tarifs'), hint: mark('Sans prix, la carte affiche « Sur demande ».'), vars: {}, link: '/admin/tarifs', action: mark('Ajouter') },
      { done: c.hours, label: mark('Indiquer vos horaires'), hint: mark('Affichés sur la page Contact et dans Google.'), vars: {}, link: '/admin/coordonnees', action: mark('Ajouter') },
      { done: c.socials, label: mark('Relier vos réseaux sociaux'), hint: mark('Instagram, Facebook, TikTok…'), vars: {}, link: '/admin/coordonnees', action: mark('Ajouter') },
      { done: c.legal, label: mark('Compléter les mentions légales'), hint: mark('Société, RC / ICE, responsable, conditions.'), vars: {}, link: '/admin/pages', action: mark('Compléter') },
      { done: c.booking_url, label: mark('Lien de réservation en ligne'), hint: mark('Agenda Dikidi pour tous les boutons « Réserver ».'), vars: {}, link: '/admin/coordonnees', action: mark('Régler') },
      { done: c.blog, label: mark('Publier vos premiers articles'), hint: mark('{n} article(s) prêt(s) à relire dans le blog.'), vars: drafts, link: '/admin/blog', action: mark('Relire') },
      {
        done: this.content.englishEnabled(), label: mark('Version anglaise du site'),
        hint: mark('Activez-la et relisez les traductions dans « Langues du site ».'), vars: {}, link: '/admin/langues', action: mark('Régler'),
      },
    ];
  });
  protected readonly doneCount = computed(() => this.todo().filter((t) => t.done).length);

  constructor() {
    this.content.load(true);
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.data.set(await this.api.dashboard());
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
