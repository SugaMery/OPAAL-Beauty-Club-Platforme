import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MonoComponent } from './ui';

/** Ligne du bon : un soin offert (noms français et anglais) ou un montant. */
export interface VoucherItem {
  fr: string;
  en: string;
  duration: string;
}

/**
 * Bon cadeau OPAAL (bilingue), d'après la trame du salon : en-tête, bandeau « Bon cadeau · Gift voucher »,
 * occasion, bénéficiaire, date d'édition, validité, « offert par », puis ce qui est offert.
 * Toutes les tailles suivent la largeur du bon (unités cqw) : il s'affiche aussi bien en aperçu que sur mobile.
 */
@Component({
  selector: 'app-gift-voucher',
  imports: [MonoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="voucher">
      <header class="v-head">
        <span class="v-brand">OPAAL</span>
        <span class="v-sub">Beauty Club</span>
        <span class="v-tag">Hair salon &amp; spa</span>
      </header>
      <div class="v-band">
        <p class="v-title">Bon cadeau · Gift voucher</p>
        @if (occasion()) {<p class="v-occasion">{{ occasion() }}</p>}
      </div>
      <div class="v-meta">
        <div class="v-for"><small>Pour · For</small><b [class.empty]="!to()">{{ to() || '…' }}</b></div>
        <div><small>Date d’édition · Issue date</small><span>{{ date() }}</span></div>
        <div><small>Validité · Validity</small><span>12 mois · 12 months</span></div>
        <div><small>Offert par · From</small><span class="v-from">{{ from() }}</span></div>
      </div>
      <div class="v-items">
        @for (it of items(); track $index) {
          <div class="v-item">
            <p class="v-fr"><b>{{ it.fr }}</b>@if (it.duration) {<span>{{ it.duration }}</span>}</p>
            <p class="v-en">{{ it.en }}</p>
          </div>
        } @empty {
          <p class="v-empty">Choisissez ce que vous offrez · Choose your gift</p>
        }
      </div>
      <footer class="v-foot">
        <app-mono cls="v-mono" />
        <p class="v-motto">Beauté — Confiance — Excellence</p>
        <p class="v-contact">Sur rendez-vous · By appointment — {{ phone() }} (WhatsApp) · &#64;opaalbeautyclub</p>
        <p class="v-contact">Opaal Beauty Club · Amelkis III Golf, Marrakech</p>
      </footer>
    </div>
  `,
})
export class GiftVoucherComponent {
  readonly occasion = input('');
  readonly to = input('');
  readonly from = input('');
  readonly date = input('');
  readonly phone = input('');
  readonly items = input<VoucherItem[]>([]);
}
