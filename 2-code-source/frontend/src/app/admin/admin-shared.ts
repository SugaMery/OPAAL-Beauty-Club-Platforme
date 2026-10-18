import { ChangeDetectionStrategy, Component, Injectable, input, signal } from '@angular/core';
import { I18N, activeLang, mark } from '../core/i18n';

/** Libellés des statuts (traduits à l'affichage). */
export const MESSAGE_LABELS: Record<string, string> = { nouveau: mark('Non lu'), lu: mark('Lu'), traite: mark('Traité') };
export const REVIEW_LABELS: Record<string, string> = { pending: mark('À valider'), approved: mark('Publié'), rejected: mark('Refusé') };
export const SUBSCRIBER_LABELS: Record<string, string> = { active: mark('Abonnée'), unsubscribed: mark('Désinscrite') };
export const CAMPAIGN_LABELS: Record<string, string> = { draft: mark('Brouillon'), sending: mark('Envoi en cours'), sent: mark('Envoyée') };

/** Télécharge un fichier CSV (séparateur « ; », lisible directement dans Excel). */
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const cell = (v: string | number) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const DAYS = {
  fr: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};
const MONTHS = {
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** Jour abrégé de la semaine (0 = dimanche), dans la langue de l'espace propriétaire. */
export function dayName(day: number): string {
  return DAYS[activeLang()][day];
}

function parse(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value.length === 10 ? value + 'T12:00:00' : value.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

/** « lun. 5 oct. 2026 » / « Mon 5 Oct 2026 » */
export function shortDate(value: string | null): string {
  const d = parse(value ?? '');
  const l = activeLang();
  return d ? `${DAYS[l][d.getDay()]} ${d.getDate()} ${MONTHS[l][d.getMonth()]} ${d.getFullYear()}` : '—';
}

/** « 5 oct. à 14h16 », « aujourd'hui à 14h16 » / « 5 Oct at 14:16 », « today at 14:16 » */
export function when(value: string): string {
  const d = parse(value);
  if (!d) return value;
  const en = activeLang() === 'en';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const time = en ? `${hh}:${mm}` : `${hh}h${mm}`;
  const today = new Date();
  const yest = new Date(today.getTime() - 86400000);
  if (d.toDateString() === today.toDateString()) return en ? `today at ${time}` : `aujourd’hui à ${time}`;
  if (d.toDateString() === yest.toDateString()) return en ? `yesterday at ${time}` : `hier à ${time}`;
  return en ? `${d.getDate()} ${MONTHS.en[d.getMonth()]} at ${time}` : `${d.getDate()} ${MONTHS.fr[d.getMonth()]} à ${time}`;
}

export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error';
}

/** Petites notifications en bas de l'écran. */
@Injectable({ providedIn: 'root' })
export class Toaster {
  readonly toasts = signal<Toast[]>([]);
  private n = 0;

  ok(text: string): void {
    this.push(text, 'ok');
  }

  error(text: string): void {
    this.push(text, 'error');
  }

  private push(text: string, kind: Toast['kind']): void {
    const id = ++this.n;
    this.toasts.update((t) => [...t, { id, text, kind }]);
    setTimeout(() => this.toasts.update((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3200);
  }
}

@Component({
  selector: 'app-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [I18N],
  template: `<span class="adm-status" [attr.data-s]="value()">{{ label() | tr }}</span>`,
})
export class StatusComponent {
  readonly value = input.required<string>();
  readonly label = input.required<string>();
}

/** Icônes fines du menu d'administration. */
@Component({
  selector: 'app-adm-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg class="adm-ico" viewBox="0 0 24 24" aria-hidden="true">
    @switch (name()) {
      @case ('home') {<path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" />}
      @case ('calendar') {<rect x="3.5" y="5" width="17" height="15" rx="1.5" /><path d="M3.5 10h17M8 3v4M16 3v4" />}
      @case ('mail') {<rect x="3" y="5.5" width="18" height="13" rx="1.5" /><path d="m3.5 6.5 8.5 7 8.5-7" />}
      @case ('star') {<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8Z" />}
      @case ('tag') {<path d="M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5Z" /><circle cx="8" cy="8.5" r="1.4" />}
      @case ('gift') {<rect x="4" y="9" width="16" height="11" rx="1" /><path d="M3 9h18M12 9v11M12 9c-1.5-3.5-6-4-5.5-1.2C7 9.4 12 9 12 9Zm0 0c1.5-3.5 6-4 5.5-1.2C17 9.4 12 9 12 9Z" />}
      @case ('pin') {<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" />}
      @case ('user') {<circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6" />}
      @case ('out') {<path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" />}
      @case ('eye') {<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" />}
      @case ('plus') {<path d="M12 5v14M5 12h14" />}
      @case ('trash') {<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />}
      @case ('phone') {<path d="M7.5 3.5 10 7.5 8.3 9.3a11 11 0 0 0 6.4 6.4l1.8-1.7 4 2.5-1.2 3c-7.3.6-15.4-7.5-14.8-14.8Z" />}
      @case ('chat') {<path d="M5 19.5 6.3 16A7.5 7.5 0 1 1 9 18.6Z" />}
      @case ('send') {<path d="M3.5 11.5 20.5 4l-7.5 17-2.5-7Z" /><path d="M10.5 14 20.5 4" />}
      @case ('check') {<path d="m5 12.5 4.5 4.5L19 7.5" />}
      @case ('x') {<path d="m6 6 12 12M18 6 6 18" />}
      @case ('menu') {<path d="M4 7h16M4 12h16M4 17h16" />}
      @case ('search') {<circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" />}
      @case ('doc') {<path d="M6 3.5h8l4 4V20.5H6Z" /><path d="M14 3.5v4h4M9 12h6M9 15.5h6" />}
      @case ('cog') {<circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />}
      @case ('users') {<circle cx="9" cy="9" r="3.3" /><path d="M3 19.5c.8-3.3 3.2-5 6-5s5.2 1.7 6 5" /><path d="M15.5 6a3 3 0 0 1 0 6M17.5 14.8c1.8.7 3 2.3 3.5 4.7" />}
      @case ('download') {<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15" />}
      @case ('link') {<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" />}
      @case ('help') {<circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.7" /><path d="M12 17h.01" />}
      @case ('chart') {<path d="M4 20h16" /><path d="M7 16v-5M12 16V7M17 16v-8" />}
      @case ('globe') {<circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.3 2.3 3.5 5.2 3.5 8.5s-1.2 6.2-3.5 8.5c-2.3-2.3-3.5-5.2-3.5-8.5S9.7 5.8 12 3.5Z" />}
      @case ('image') {<rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><circle cx="9" cy="9.5" r="1.8" /><path d="m4 17.5 5-5 4 4 2.5-2.5 5 5" />}
      @case ('up') {<path d="m6 14 6-6 6 6" />}
      @case ('down') {<path d="m6 10 6 6 6-6" />}
      @case ('lang') {<path d="M3.5 5.5h9M8 3.5v2M5.5 5.5c.6 3.2 2.6 5.6 5.5 7M10.5 5.5c-.8 3.4-3.2 6.2-6.5 7.5" /><path d="m12.5 20.5 4-9 4 9M14 17.5h5" />}
      @case ('copy') {<rect x="8.5" y="8.5" width="11" height="11" rx="1.5" /><path d="M15.5 8.5V5.5a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3" />}
    }
  </svg>`,
})
export class AdmIconComponent {
  readonly name = input.required<string>();
}
