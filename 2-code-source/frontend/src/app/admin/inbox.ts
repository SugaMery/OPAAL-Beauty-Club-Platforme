import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorMessage } from '../core/api.service';
import { AdminApi, InboxItem, InboxMessage } from './admin-api';
import { AdmIconComponent, Toaster, when } from './admin-shared';
import { ADMIN_I18N } from './admin-i18n';
import { I18nService } from '../core/i18n';

/** Boîte de réception de l'adresse du salon (lecture + réponse depuis l'espace propriétaire). */
@Component({
  selector: 'app-admin-inbox',
  imports: [FormsModule, AdmIconComponent, ADMIN_I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-page-head">
      <div>
        <h1>{{ 'Boîte de réception' | tr }}</h1>
        <p class="adm-muted">{{ 'Les e-mails reçus sur' | tr }} <b>{{ account() || ('l’adresse du salon' | tr) }}</b>. {{ 'Répondez directement d’ici : la réponse part de cette même adresse.' | tr }}</p>
      </div>
      <div class="adm-actions" style="margin: 0">
        <button type="button" class="adm-btn" (click)="load(page())" [disabled]="loading()"><app-adm-icon name="send" /> {{ (loading() ? 'Actualisation…' : 'Actualiser') | tr }}</button>
        <a class="adm-btn" href="https://mail.ionos.fr" target="_blank" rel="noopener"><app-adm-icon name="mail" /> {{ 'Webmail IONOS' | tr }}</a>
      </div>
    </div>

    @if (error()) {
      <p class="adm-error">{{ error() }}</p>
    }

    <div class="adm-inbox" [class.reading]="!!current()">
      <section class="adm-card adm-inbox-list">
        <header class="adm-card-head">
          <h2>{{ (total() > 1 ? '{n} messages' : '{n} message') | tr: { n: total() } }}</h2>
          @if (unseen()) {<span class="adm-pill gold">{{ (unseen() > 1 ? '{n} non lus' : '{n} non lu') | tr: { n: unseen() } }}</span>}
        </header>
        @if (loading() && !items().length) {
          <div class="adm-loading"><span></span><span></span><span></span></div>
        }
        <ul>
          @for (m of items(); track m.uid) {
            <li>
              <button type="button" [class.unread]="!m.seen" [class.active]="current()?.uid === m.uid" (click)="open(m)">
                <span class="from">{{ m.from || m.from_email }}</span>
                <span class="date">{{ when(m.date) }}</span>
                <span class="subj">{{ m.subject }}</span>
              </button>
            </li>
          } @empty {
            @if (!loading()) {<li class="adm-empty">{{ 'Aucun message.' | tr }}</li>}
          }
        </ul>
        @if (pages() > 1) {
          <div class="adm-actions">
            <button type="button" class="adm-btn sm" [disabled]="page() <= 1 || loading()" (click)="load(page() - 1)">← {{ 'Plus récents' | tr }}</button>
            <span class="adm-muted">{{ 'Page {n} / {total}' | tr: { n: page(), total: pages() } }}</span>
            <button type="button" class="adm-btn sm" [disabled]="page() >= pages() || loading()" (click)="load(page() + 1)">{{ 'Plus anciens' | tr }} →</button>
          </div>
        }
      </section>

      <section class="adm-card adm-inbox-read">
        @if (reading()) {
          <div class="adm-loading"><span></span><span></span><span></span></div>
        } @else if (current(); as m) {
          <button type="button" class="adm-btn sm adm-inbox-back" (click)="current.set(null)">← {{ 'Retour à la liste' | tr }}</button>
          <h2>{{ m.subject }}</h2>
          <p class="adm-muted"><b>{{ m.from }}</b> &lt;{{ m.from_email }}&gt; · {{ when(m.date) }}</p>
          @if (m.attachments.length) {
            <p class="adm-hint">📎 {{ '{n} pièce(s) jointe(s) : {names} — à ouvrir dans le webmail IONOS.' | tr: { n: m.attachments.length, names: names(m) } }}</p>
          }
          <div class="adm-mail-text">{{ m.text }}</div>

          <form class="adm-side-panel" (ngSubmit)="reply(m)">
            <h3>{{ 'Répondre à {name}' | tr: { name: m.from || m.from_email } }}</h3>
            <textarea name="reply" rows="6" [(ngModel)]="replyText" [placeholder]="'Votre réponse…' | tr"></textarea>
            <div class="adm-actions">
              <button class="adm-btn primary" type="submit" [disabled]="sending() || !replyText.trim()"><app-adm-icon name="send" /> {{ (sending() ? 'Envoi…' : 'Envoyer la réponse') | tr }}</button>
              <a class="adm-btn" [href]="'mailto:' + m.from_email + '?subject=' + encode('Re: ' + m.subject)">{{ 'Répondre avec ma messagerie' | tr }}</a>
            </div>
          </form>
        } @else {
          <p class="adm-empty">{{ 'Choisissez un message dans la liste pour le lire.' | tr }}</p>
        }
      </section>
    </div>
  `,
})
export class InboxPage {
  private readonly api = inject(AdminApi);
  private readonly toaster = inject(Toaster);
  private readonly i18n = inject(I18nService);
  protected readonly when = when;
  protected readonly items = signal<InboxItem[]>([]);
  protected readonly total = signal(0);
  protected readonly unseen = signal(0);
  protected readonly page = signal(1);
  protected readonly pages = signal(1);
  protected readonly loading = signal(false);
  protected readonly reading = signal(false);
  protected readonly sending = signal(false);
  protected readonly error = signal('');
  protected readonly account = signal('');
  protected readonly current = signal<InboxMessage | null>(null);
  protected replyText = '';

  constructor() {
    void this.load(1);
    void this.api.smtp().then((s) => this.account.set(s.username)).catch(() => undefined);
  }

  protected async load(page: number): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const r = await this.api.inbox(page);
      this.items.set(r.items);
      this.total.set(r.total);
      this.unseen.set(r.unseen);
      this.page.set(r.page);
      this.pages.set(r.pages);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected async open(m: InboxItem): Promise<void> {
    this.reading.set(true);
    this.replyText = '';
    try {
      this.current.set(await this.api.inboxMessage(m.uid));
      if (!m.seen) {
        this.items.update((l) => l.map((x) => (x.uid === m.uid ? { ...x, seen: true } : x)));
        this.unseen.update((n) => Math.max(0, n - 1));
      }
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.reading.set(false);
    }
  }

  protected names(m: InboxMessage): string {
    return m.attachments.map((a) => a.name).join(', ');
  }

  protected encode(s: string): string {
    return encodeURIComponent(s);
  }

  protected async reply(m: InboxMessage): Promise<void> {
    this.sending.set(true);
    try {
      const subject = /^re\s*:/i.test(m.subject) ? m.subject : 'Re : ' + m.subject;
      const r = await this.api.replyEmail({ to: m.from_email, subject, text: this.replyText, in_reply_to: m.message_id });
      if (r.ok) {
        this.toaster.ok(this.i18n.tr('Réponse envoyée à {email}.', { email: m.from_email }));
        this.replyText = '';
      } else {
        this.toaster.error(this.i18n.tr('Échec de l’envoi : {error}', { error: r.error }));
      }
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.sending.set(false);
    }
  }
}
