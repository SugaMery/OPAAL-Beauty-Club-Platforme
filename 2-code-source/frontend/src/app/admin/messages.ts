import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { errorMessage } from '../core/api.service';
import { telHref } from '../core/format';
import { I18nService, Lang, mark, translate } from '../core/i18n';
import { AdminApi, Message, MessageStatus } from './admin-api';
import { AdmIconComponent, MESSAGE_LABELS, StatusComponent, Toaster, when } from './admin-shared';
import { ADMIN_I18N } from './admin-i18n';

@Component({
  selector: 'app-admin-messages',
  imports: [FormsModule, AdmIconComponent, StatusComponent, ADMIN_I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-page-head">
      <div>
        <h1>{{ 'Messages' | tr }}</h1>
        <p class="adm-muted">{{ 'Les messages envoyés depuis la page Contact. Une copie arrive aussi dans votre boîte e-mail.' | tr }}
          {{ 'L’étiquette EN indique une cliente venue du site anglais : les boutons de réponse préparent un texte en anglais.' | tr }}</p>
      </div>
      <input class="adm-search" type="search" [placeholder]="'Rechercher…' | tr" [ngModel]="query()" (ngModelChange)="query.set($event)" />
    </div>
    <div class="adm-tabs">
      @for (t of tabs; track t.key) {
        <button type="button" [class.active]="tab() === t.key" (click)="tab.set(t.key)">{{ t.label | tr }} <b>{{ count(t.key) }}</b></button>
      }
    </div>

    @if (loading()) {
      <div class="adm-loading"><span></span><span></span><span></span></div>
    } @else if (!filtered().length) {
      <p class="adm-empty">{{ 'Aucun message dans cette liste.' | tr }}</p>
    } @else {
      <div class="adm-items">
        @for (m of filtered(); track m.id) {
          <article class="adm-item" [class.open]="openId() === m.id" [class.unread]="m.status === 'nouveau'">
            <button type="button" class="adm-item-head" (click)="toggle(m)" [attr.aria-expanded]="openId() === m.id">
              <div class="who"><strong>{{ m.name }} <app-lang-badge [lang]="m.lang || 'fr'" /></strong><span>{{ m.email }}</span></div>
              <div class="what"><strong>{{ m.subject ? (m.subject | tr) : ('Message' | tr) }}</strong><span>{{ m.message.slice(0, 80) }}{{ m.message.length > 80 ? '…' : '' }}</span></div>
              <app-status [value]="m.status" [label]="labels[m.status]" />
              <span class="when">{{ when(m.created_at) }}</span>
            </button>
            @if (openId() === m.id) {
              <div class="adm-item-body single">
                <div class="adm-detail">
                  <dl>
                    <div><dt>{{ 'E-mail' | tr }}</dt><dd><a [href]="'mailto:' + m.email">{{ m.email }}</a></dd></div>
                    <div><dt>{{ 'Téléphone' | tr }}</dt><dd>@if (m.phone) {<a [href]="tel(m.phone)">{{ m.phone }}</a>} @else {<em>{{ 'non renseigné' | tr }}</em>}</dd></div>
                    <div><dt>{{ 'Sujet' | tr }}</dt><dd>{{ m.subject ? (m.subject | tr) : '—' }}</dd></div>
                    <div><dt>{{ 'Langue' | tr }}</dt><dd>{{ (m.lang === 'en' ? 'Anglais (site en anglais)' : 'Français') | tr }}</dd></div>
                    <div><dt>{{ 'Reçu' | tr }}</dt><dd>{{ when(m.created_at) }}</dd></div>
                  </dl>
                  <blockquote class="adm-quote">{{ m.message }}</blockquote>
                  <label class="adm-note">{{ 'Note interne' | tr }}<textarea rows="2" [(ngModel)]="note"></textarea></label>
                  <div class="adm-actions">
                    <a class="adm-btn primary" [href]="reply(m)"><app-adm-icon name="mail" /> {{ 'Répondre par e-mail' | tr }}</a>
                    @if (m.phone) {<a class="adm-btn" [href]="wa(m)" target="_blank" rel="noopener"><app-adm-icon name="chat" /> WhatsApp</a>}
                    <button type="button" class="adm-btn" (click)="save(m, 'traite')"><app-adm-icon name="check" /> {{ 'Marquer traité' | tr }}</button>
                    <button type="button" class="adm-btn" (click)="save(m, m.status)">{{ 'Enregistrer la note' | tr }}</button>
                    @if (m.status !== 'nouveau') {<button type="button" class="adm-btn" (click)="save(m, 'nouveau')">{{ 'Marquer non lu' | tr }}</button>}
                    <button type="button" class="adm-btn danger" (click)="remove(m)"><app-adm-icon name="trash" /> {{ 'Supprimer' | tr }}</button>
                  </div>
                </div>
              </div>
            }
          </article>
        }
      </div>
    }
  `,
})
export class MessagesPage {
  private readonly api = inject(AdminApi);
  private readonly toaster = inject(Toaster);
  private readonly i18n = inject(I18nService);
  protected readonly labels = MESSAGE_LABELS;
  protected readonly when = when;
  protected readonly items = signal<Message[]>([]);
  protected readonly loading = signal(true);
  protected readonly tab = signal<'all' | MessageStatus>('all');
  protected readonly query = signal('');
  protected readonly openId = signal<number | null>(null);
  protected note = '';
  protected readonly tabs: { key: 'all' | MessageStatus; label: string }[] = [
    { key: 'all', label: mark('Tous') },
    { key: 'nouveau', label: mark('Non lus') },
    { key: 'lu', label: mark('Lus') },
    { key: 'traite', label: mark('Traités') },
  ];
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.items().filter(
      (m) => (this.tab() === 'all' || m.status === this.tab()) && (!q || [m.name, m.email, m.subject, m.message].join(' ').toLowerCase().includes(q)),
    );
  });

  constructor() {
    const wanted = Number(inject(ActivatedRoute).snapshot.queryParamMap.get('id')) || null;
    void this.load().then(() => {
      const m = wanted ? this.items().find((x) => x.id === wanted) : undefined;
      if (m) this.toggle(m);
    });
  }

  protected count(key: 'all' | MessageStatus): number {
    return key === 'all' ? this.items().length : this.items().filter((m) => m.status === key).length;
  }

  private async load(): Promise<void> {
    try {
      this.items.set(await this.api.messages());
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected toggle(m: Message): void {
    if (this.openId() === m.id) {
      this.openId.set(null);
      return;
    }
    this.note = m.admin_note;
    this.openId.set(m.id);
    if (m.status === 'nouveau') {
      void this.save(m, 'lu', true);
    }
  }

  protected tel(p: string): string {
    return telHref(p);
  }

  /** Langue de la cliente : les réponses préparées sont écrites dans sa langue. */
  private clientLang(m: Message): Lang {
    return m.lang === 'en' ? 'en' : 'fr';
  }

  protected reply(m: Message): string {
    const l = this.clientLang(m);
    const subject = 'Re : ' + (m.subject ? translate(l, m.subject) : translate(l, 'Votre message à OPAAL Beauty Club'));
    const body = translate(l, 'Bonjour {name},', { name: m.name.split(' ')[0] }) + '\n\n';
    return `mailto:${m.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  protected wa(m: Message): string {
    let d = m.phone.replace(/\D/g, '');
    if (/^0\d{9}$/.test(d)) d = '212' + d.slice(1);
    const text = translate(this.clientLang(m), 'Bonjour {name}, c’est OPAAL Beauty Club.', { name: m.name.split(' ')[0] });
    return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
  }

  protected async save(m: Message, status: MessageStatus, silent = false): Promise<void> {
    try {
      const updated = await this.api.updateMessage(m.id, { status, admin_note: this.note });
      this.items.update((list) => list.map((x) => (x.id === m.id ? updated : x)));
      if (!silent) this.toaster.ok(this.i18n.tr('Message mis à jour.'));
      void this.api.refreshBadges();
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }

  protected async remove(m: Message): Promise<void> {
    if (!confirm(this.i18n.tr('Supprimer le message de {name} ?', { name: m.name }))) return;
    try {
      await this.api.deleteMessage(m.id);
      this.items.update((list) => list.filter((x) => x.id !== m.id));
      this.toaster.ok(this.i18n.tr('Message supprimé.'));
      void this.api.refreshBadges();
    } catch (e) {
      this.toaster.error(errorMessage(e));
    }
  }
}
