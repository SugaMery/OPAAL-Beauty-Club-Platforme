import { ChangeDetectionStrategy, Component, DOCUMENT, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FX } from '../core/fx';
import { BookingService } from '../core/booking.service';
import { ContentService } from '../core/content.service';
import { PublicApi, errorMessage, fieldErrors } from '../core/api.service';
import { SeoService } from '../core/seo.service';
import { formatDuration } from '../core/format';
import { I18N, I18nService, mark } from '../core/i18n';
import { Category, Service } from '../core/models';
import { ArrowComponent, GiftCardComponent } from '../shared/ui';
import { GiftVoucherComponent, VoucherItem } from '../shared/gift-voucher';
import { CtaComponent } from '../shared/layout';

const PHONE = /^[+0-9 ().-]{8,25}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Montants proposés (en DH), en plus d'un montant libre. */
const AMOUNTS = [500, 1000, 1500, 2000];
/** Nombre maximum de soins sur un même bon. */
const MAX_SERVICES = 6;
/** Occasions imprimées sur le bon, en français et en anglais (comme sur la trame du salon). */
const OCCASIONS = [
  { value: '', label: mark('Sans occasion particulière'), line: '' },
  { value: 'anniversaire', label: mark('Anniversaire'), line: 'Joyeux anniversaire · Happy birthday' },
  { value: 'merci', label: mark('Remerciement'), line: 'Merci · Thank you' },
  { value: 'felicitations', label: mark('Félicitations'), line: 'Félicitations · Congratulations' },
  { value: 'amour', label: mark('Avec amour'), line: 'Avec tout mon amour · With all my love' },
  { value: 'meres', label: mark('Fête des mères'), line: 'Bonne fête des mères · Happy Mother’s Day' },
  { value: 'valentin', label: mark('Saint-Valentin'), line: 'Joyeuse Saint-Valentin · Happy Valentine’s Day' },
  { value: 'aid', label: mark('Aïd'), line: 'Aïd Moubarak · Eid Mubarak' },
  { value: 'fetes', label: mark('Fêtes de fin d’année'), line: 'Joyeuses fêtes · Season’s greetings' },
  { value: 'soin', label: mark('Prendre soin de soi'), line: 'Prends soin de toi · Take care of yourself' },
];
const DELIVERY = [
  { value: 'salon', label: mark('Retrait au salon'), hint: mark('Le bon imprimé, prêt à offrir.') },
  { value: 'email-beneficiaire', label: mark('Par e-mail à la personne choisie'), hint: mark('Nous lui envoyons le bon cadeau.') },
  { value: 'email-moi', label: mark('Par e-mail, à moi'), hint: mark('Vous l’offrez vous-même.') },
];

/** Date d'édition imprimée sur le bon : « 12 octobre 2026 · October 12, 2026 ». */
function issueDate(d = new Date()): string {
  const fr = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const en = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  return `${fr} · ${en}`;
}

/** Formulaire de commande de bon cadeau : envoyé comme message (boîte de réception + e-mails), avec aperçu du bon. */
@Component({
  selector: 'app-gift-form',
  imports: [ReactiveFormsModule, ArrowComponent, GiftVoucherComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gift-order">
      @if (sent()) {
        <div class="form-success gift-success" role="status">
          <div class="success-mark" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" pathLength="1" /><path d="M15 27l7 7 15-16" pathLength="1" /></svg></div>
          <h3>{{ 'Demande envoyée' | tr }}</h3>
          <p>{{ 'Merci ! Nous avons bien reçu votre demande de bon cadeau. Nous vous contactons très vite pour finaliser le règlement et la remise du bon. Un e-mail récapitulatif vous a été envoyé.' | tr }}</p>
          <button type="button" class="link-arrow" (click)="again()">{{ 'Offrir un autre bon cadeau' | tr }} <app-arrow /></button>
        </div>
      } @else {
        <form class="gift-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <section class="gf-step">
            <header class="gf-head"><span class="gf-num">I</span><h3>{{ 'Ce que vous offrez' | tr }}</h3></header>
            <div class="gf-switch" role="radiogroup" [attr.aria-label]="'Type de bon' | tr">
              <label [class.on]="v().kind === 'soin'"><input type="radio" formControlName="kind" value="soin" />{{ 'Des soins' | tr }}</label>
              <label [class.on]="v().kind === 'montant'"><input type="radio" formControlName="kind" value="montant" />{{ 'Un montant' | tr }}</label>
            </div>

            @if (v().kind === 'soin') {
              <div class="gf-tabs" role="tablist" [attr.aria-label]="'Nos univers' | tr">
                @for (c of content.categories(); track c.id) {
                  <button type="button" role="tab" class="gf-tab" [class.on]="activeCat()?.id === c.id" [attr.aria-selected]="activeCat()?.id === c.id" (click)="cat.set(c.id)">
                    {{ c.title }}@if (countIn(c.id)) {<i>{{ countIn(c.id) }}</i>}
                  </button>
                }
              </div>
              <ul class="gf-menu" [class.invalid]="badCustom('services')">
                @for (s of activeCat()?.services ?? []; track s.id) {
                  <li>
                    <button type="button" class="gf-item" [class.on]="isSelected(s.id)" [attr.aria-pressed]="isSelected(s.id)"
                      [disabled]="!isSelected(s.id) && selected().length >= max" (click)="toggle(s.id)">
                      <span class="gf-check" aria-hidden="true"></span>
                      <span class="gf-name">{{ s.name }}@if (s.duration) {<small>{{ dur(s.duration) }}</small>}</span>
                      <span class="gf-dots" aria-hidden="true"></span>
                      <span class="gf-price">{{ content.price(s) }}</span>
                    </button>
                  </li>
                }
              </ul>
              @if (badCustom('services')) {<small class="err">{{ 'Choisissez au moins un soin à offrir.' | tr }}</small>}
              @if (selected().length) {
                <div class="gf-basket">
                  <p class="gf-label">{{ 'Votre sélection' | tr }} <em>{{ selected().length }}/{{ max }}</em></p>
                  <ul>
                    @for (s of selected(); track s.id) {
                      <li>{{ s.name }}@if (s.duration) {<small>{{ dur(s.duration) }}</small>}
                        <button type="button" (click)="remove(s.id)" [attr.aria-label]="'Retirer {name}' | tr: { name: s.name }">×</button></li>
                    }
                  </ul>
                </div>
              }
            } @else {
              <div class="gf-amounts" role="radiogroup" [attr.aria-label]="'Montant' | tr">
                @for (a of amounts; track a) {
                  <label [class.on]="v().amount === '' + a"><input type="radio" formControlName="amount" [value]="'' + a" />{{ money(a) }}</label>
                }
                <label [class.on]="v().amount === 'autre'"><input type="radio" formControlName="amount" value="autre" />{{ 'Autre' | tr }}</label>
              </div>
              @if (v().amount === 'autre') {
                <label class="gf-field">{{ 'Montant souhaité (DH)' | tr }}
                  <input formControlName="other" type="number" min="100" step="50" inputmode="numeric" [class.invalid]="badCustom('other')" />
                  @if (badCustom('other')) {<small class="err">{{ 'Indiquez un montant d’au moins 100 DH.' | tr }}</small>}
                </label>
              }
            }
          </section>

          <section class="gf-step">
            <header class="gf-head"><span class="gf-num">II</span><h3>{{ 'Pour qui, et pour quelle occasion ?' | tr }}</h3></header>
            <div class="gf-occasions" role="radiogroup" [attr.aria-label]="'Occasion' | tr">
              @for (o of occasions; track o.value) {
                <label [class.on]="v().occasion === o.value"><input type="radio" formControlName="occasion" [value]="o.value" />{{ o.label | tr }}</label>
              }
            </div>
            <div class="gf-row">
              <label class="gf-field">{{ 'Pour' | tr }}
                <input formControlName="to" autocomplete="off" maxlength="60" [placeholder]="'Prénom de la personne choisie' | tr" [class.invalid]="bad('to')" />
                @if (bad('to')) {<small class="err">{{ 'Indiquez le prénom de la personne à qui vous l’offrez.' | tr }}</small>}
              </label>
              <label class="gf-field">{{ 'Offert par' | tr }} <em>{{ '(optionnel)' | tr }}</em>
                <input formControlName="from" autocomplete="off" maxlength="60" [placeholder]="'Votre prénom' | tr" />
              </label>
            </div>
            <label class="gf-field">{{ 'Petit mot à transmettre' | tr }} <em>{{ '(optionnel)' | tr }}</em>
              <textarea formControlName="note" rows="2" maxlength="250"></textarea>
            </label>
          </section>

          <section class="gf-step">
            <header class="gf-head"><span class="gf-num">III</span><h3>{{ 'Remise du bon' | tr }}</h3></header>
            <div class="gf-delivery" role="radiogroup" [attr.aria-label]="'Remise du bon' | tr">
              @for (d of delivery; track d.value) {
                <label [class.on]="v().delivery === d.value">
                  <input type="radio" formControlName="delivery" [value]="d.value" />
                  <b>{{ d.label | tr }}</b><small>{{ d.hint | tr }}</small>
                </label>
              }
            </div>
            @if (v().delivery === 'email-beneficiaire') {
              <label class="gf-field">{{ 'E-mail de la personne choisie' | tr }}
                <input formControlName="toEmail" type="email" autocomplete="off" [class.invalid]="badCustom('toEmail')" />
                @if (badCustom('toEmail')) {<small class="err">{{ 'Adresse e-mail invalide.' | tr }}</small>}
              </label>
            }
          </section>

          <section class="gf-step">
            <header class="gf-head"><span class="gf-num">IV</span><h3>{{ 'Vos coordonnées' | tr }}</h3></header>
            <div class="gf-row">
              <label class="gf-field">{{ 'Nom complet' | tr }}
                <input formControlName="name" autocomplete="name" [class.invalid]="bad('name')" />
                @if (bad('name')) {<small class="err">{{ err('name', 'Indiquez votre nom.') }}</small>}
              </label>
              <label class="gf-field">{{ 'Téléphone' | tr }}
                <input formControlName="phone" type="tel" autocomplete="tel" [class.invalid]="bad('phone')" />
                @if (bad('phone')) {<small class="err">{{ err('phone', 'Indiquez un numéro pour que nous puissions vous joindre.') }}</small>}
              </label>
            </div>
            <label class="gf-field">{{ 'E-mail' | tr }}
              <input formControlName="email" type="email" autocomplete="email" [class.invalid]="bad('email')" />
              @if (bad('email')) {<small class="err">{{ err('email', 'Adresse e-mail invalide.') }}</small>}
            </label>
          </section>

          <input class="hp" formControlName="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
          <div class="gf-submit">
            @if (totalLabel()) {<p class="gf-total"><span>{{ 'Valeur du bon' | tr }}</span><b>{{ totalLabel() }}</b></p>}
            @if (error()) {<p class="form-error" role="alert">{{ error() }}</p>}
            <button class="btn btn-dark btn-block btn-shine" type="submit" [disabled]="busy()">
              {{ (busy() ? 'Envoi en cours…' : 'Envoyer ma demande') | tr }} <app-arrow />
            </button>
            <p class="form-note">{{ 'Aucun paiement n’est demandé en ligne pour le moment : nous vous contactons pour finaliser le règlement et vous remettre le bon cadeau, valable 12 mois.' | tr }}</p>
          </div>
        </form>
      }

      <aside class="gift-preview" aria-hidden="true">
        <app-gift-voucher [occasion]="occasionLine()" [to]="v().to.trim()" [from]="v().from.trim()" [date]="date"
          [phone]="content.settings().phone" [items]="voucherItems()" />
        <p class="gift-preview-note">{{ 'Aperçu de votre bon cadeau' | tr }}</p>
      </aside>
    </div>
  `,
})
export class GiftFormComponent {
  private readonly api = inject(PublicApi);
  private readonly i18n = inject(I18nService);
  protected readonly content = inject(ContentService);
  protected readonly amounts = AMOUNTS;
  protected readonly occasions = OCCASIONS;
  protected readonly delivery = DELIVERY;
  protected readonly max = MAX_SERVICES;
  protected readonly date = issueDate();
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal('');
  private readonly submitted = signal(false);
  private readonly serverErrors = signal<Record<string, string>>({});
  /** Identifiants des soins offerts, dans l'ordre choisi. */
  private readonly ids = signal<number[]>([]);
  /** Univers affiché dans la carte des soins (le premier par défaut). */
  protected readonly cat = signal<number | null>(null);
  protected readonly activeCat = computed<Category | undefined>(() => {
    const cats = this.content.categories();
    return cats.find((c) => c.id === this.cat()) ?? cats[0];
  });

  protected readonly form = inject(FormBuilder).nonNullable.group({
    kind: ['soin'],
    amount: ['1000'],
    other: [''],
    occasion: [''],
    to: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    from: ['', [Validators.maxLength(60)]],
    note: ['', [Validators.maxLength(250)]],
    delivery: ['salon'],
    toEmail: [''],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    phone: ['', [Validators.required, Validators.pattern(PHONE)]],
    website: [''],
  });
  /** Valeurs du formulaire (aperçu du bon en direct). */
  protected readonly v = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), { initialValue: this.form.getRawValue() });

  /** Soins de la carte (textes du site) et leurs noms d'origine (français et anglais) pour le bon. */
  private readonly all = computed(() => this.content.categories().flatMap((c) => c.services));
  private readonly raw = computed(() => new Map(this.content.rawCategories().flatMap((c) => c.services).map((s) => [s.id, s])));
  protected readonly selected = computed(() => this.ids().map((id) => this.all().find((s) => s.id === id)).filter((s): s is Service => !!s));

  protected readonly total = computed(() => {
    const list = this.selected();
    const sum = list.reduce((n, s) => n + (s.price ?? 0), 0);
    return this.content.price({ price: sum, price_from: list.some((s) => s.price_from || s.price === null) });
  });

  /** Valeur affichée au-dessus du bouton d'envoi : total des soins ou montant choisi. */
  protected readonly totalLabel = computed(() => {
    if (this.v().kind === 'soin') return this.selected().length ? this.total() : '';
    const n = this.amountValue();
    return n ? this.money(n) : '';
  });

  protected readonly occasionLine = computed(() => OCCASIONS.find((o) => o.value === this.v().occasion)?.line ?? '');

  /** Lignes du bon : chaque soin (français / anglais, durée) ou le montant offert. */
  protected readonly voucherItems = computed<VoucherItem[]>(() => {
    const v = this.v();
    if (v.kind === 'montant') {
      const n = this.amountValue();
      if (!n) return [];
      const amount = new Intl.NumberFormat('fr-FR').format(n).replace(/\s/g, ' ');
      return [{ fr: `Bon d’une valeur de ${amount} DH`, en: `Gift voucher worth ${amount} DH`, duration: '' }];
    }
    return this.selected().map((s) => {
      const r = this.raw().get(s.id);
      return { fr: r?.name ?? s.name, en: r?.name_en || r?.name || s.name, duration: s.duration ? `${s.duration} min` : '' };
    });
  });

  private amountValue(): number {
    const v = this.v();
    const n = v.amount === 'autre' ? Number(v.other) : Number(v.amount);
    return n > 0 ? n : 0;
  }

  protected dur(m: number): string {
    return formatDuration(m, this.i18n.lang());
  }

  protected money(n: number): string {
    return this.content.price({ price: n, price_from: false });
  }

  protected serviceLabel(s: Service): string {
    const d = s.duration ? ' · ' + this.dur(s.duration) : '';
    return `${s.name}${d} — ${this.content.price(s)}`;
  }

  protected isSelected(id: number): boolean {
    return this.ids().includes(id);
  }

  /** Coche ou décoche un soin de la carte. */
  protected toggle(id: number): void {
    if (this.isSelected(id)) {
      this.remove(id);
    } else if (this.ids().length < MAX_SERVICES) {
      this.ids.update((l) => [...l, id]);
    }
  }

  /** Nombre de soins choisis dans un univers (pastille sur l'onglet). */
  protected countIn(catId: number): number {
    const cat = this.content.categories().find((c) => c.id === catId);
    return cat ? cat.services.filter((s) => this.isSelected(s.id)).length : 0;
  }

  protected remove(id: number): void {
    this.ids.update((l) => l.filter((x) => x !== id));
  }

  protected bad(name: string): boolean {
    const c = this.form.get(name);
    return (!!c && c.invalid && (c.touched || c.dirty)) || !!this.serverErrors()[name];
  }

  /** Champs requis selon les choix (soins, montant libre, e-mail de la personne choisie). */
  private customError(name: string): boolean {
    const v = this.form.getRawValue();
    if (name === 'services') return v.kind === 'soin' && !this.ids().length;
    if (name === 'other') return v.kind === 'montant' && v.amount === 'autre' && !(Number(v.other) >= 100);
    if (name === 'toEmail') return v.delivery === 'email-beneficiaire' && !EMAIL.test(v.toEmail.trim());
    return false;
  }

  protected badCustom(name: string): boolean {
    this.v();
    this.ids();
    return this.submitted() && this.customError(name);
  }

  protected err(name: string, fallback: string): string {
    return this.serverErrors()[name] ?? this.i18n.tr(fallback);
  }

  protected again(): void {
    this.form.reset();
    this.cat.set(null);
    this.ids.set([]);
    this.submitted.set(false);
    this.sent.set(false);
  }

  /** Récapitulatif envoyé à la propriétaire (boîte de réception + e-mail) et rappelé à la cliente. */
  private summary(): string {
    const v = this.form.getRawValue();
    const t = (s: string) => this.i18n.tr(s);
    const lines = [t('Commande de bon cadeau'), ''];
    if (v.kind === 'soin') {
      lines.push(t('Soins offerts') + ' :');
      for (const s of this.selected()) lines.push(`- ${this.serviceLabel(s)}`);
      lines.push(`${t('Total')} : ${this.total()}`);
    } else {
      lines.push(`${t('Montant')} : ${this.money(this.amountValue())}`);
    }
    lines.push('');
    const occ = OCCASIONS.find((o) => o.value === v.occasion);
    if (occ?.line) lines.push(`${t('Occasion')} : ${occ.line}`);
    lines.push(`${t('Pour')} : ${v.to.trim()}`);
    if (v.from.trim()) lines.push(`${t('Offert par')} : ${v.from.trim()}`);
    if (v.note.trim()) lines.push(`${t('Petit mot à transmettre')} : « ${v.note.trim()} »`);
    const d = DELIVERY.find((x) => x.value === v.delivery) ?? DELIVERY[0];
    lines.push(`${t('Remise du bon')} : ${t(d.label)}${v.delivery === 'email-beneficiaire' ? ` (${v.toEmail.trim()})` : ''}`);
    lines.push(`${t('Téléphone')} : ${v.phone.trim()}`);
    return lines.join('\n');
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    this.submitted.set(true);
    this.serverErrors.set({});
    if (this.form.invalid || ['services', 'other', 'toEmail'].some((n) => this.customError(n))) {
      this.error.set(this.i18n.tr('Merci de vérifier les champs en rouge.'));
      return;
    }
    this.busy.set(true);
    this.error.set('');
    const v = this.form.getRawValue();
    try {
      await this.api.contact({ name: v.name, email: v.email, phone: v.phone, subject: 'Carte cadeau', message: this.summary(), website: v.website });
      this.sent.set(true);
    } catch (e) {
      this.serverErrors.set(fieldErrors(e));
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}

/** Page Carte cadeau : présentation et formulaire de commande du bon cadeau (paiement en ligne à venir). */
@Component({
  selector: 'app-gift',
  imports: [FX, RouterLink, ArrowComponent, GiftCardComponent, GiftFormComponent, CtaComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="m-hero gift-hero">
      <div class="pan-bg" aria-hidden="true"></div>
      <canvas class="sparkles" data-density=".8" aria-hidden="true"></canvas>
      <div class="container">
        <div>
          <nav class="breadcrumb" data-anim="fade" [attr.aria-label]="'Fil d’Ariane' | tr"><a [routerLink]="'/' | lp">{{ 'Accueil' | tr }}</a><i></i><span>{{ 'Carte cadeau' | tr }}</span></nav>
          <p class="eyebrow line" data-anim="fade" style="--d: 0.1s">{{ 'Carte cadeau' | tr }}</p>
          <h1 data-split>{{ 'Offrez un moment' | tr }}<br /><em>{{ 'd’exception.' | tr }}</em></h1>
          <p class="lead" data-anim="up" style="--d: 0.4s">{{ 'Soin du visage, massage, coiffure ou rituel mains & pieds : offrez une parenthèse de bien-être au Club House d’Amelkis 3, face aux fairways.' | tr }}</p>
          <div class="btn-row" data-anim="up" style="--d: 0.55s">
            <a class="btn btn-dark btn-shine" [href]="('/carte-cadeau' | lp) + '#commande'" (click)="go($event)">{{ 'Composer mon bon cadeau' | tr }} <app-arrow /></a>
            <a class="link-arrow" [href]="booking.whatsapp('Bonjour OPAAL Beauty Club, je souhaite offrir une carte cadeau.' | tr)" target="_blank" rel="noopener" (click)="booking.track('Carte cadeau', 'whatsapp')">{{ 'Par WhatsApp' | tr }} <app-arrow /></a>
          </div>
        </div>
        <div class="member-card-wrap" data-anim="zoom" style="--d: 0.3s" aria-hidden="true"><div class="floaty"><app-gift-card /></div></div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="center values-head">
          <p class="eyebrow center" data-anim="fade">{{ 'Comment ça marche' | tr }}</p>
          <h2 class="h2" data-split>{{ 'Un bon cadeau en 3 étapes' | tr }}</h2>
        </div>
        <div class="steps three">
          <span class="line"></span>
          @for (st of steps; track st.title; let i = $index) {
            <div class="step" data-anim="up" [style.--i]="i">
              <div class="step-num">0{{ i + 1 }}</div>
              <h3>{{ st.title | tr }}</h3>
              <p>{{ st.text | tr }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <section class="section gift-order-section" id="commande">
      <div class="container">
        <div class="center values-head">
          <p class="eyebrow center" data-anim="fade">{{ 'Commander' | tr }}</p>
          <h2 class="h2" data-split>{{ 'Composez votre bon cadeau' | tr }}</h2>
          <p class="lead" data-anim="up" style="--d: 0.2s">{{ 'Choisissez les soins à offrir dans notre carte : le bon se compose sous vos yeux. Nous vous contactons ensuite pour le règlement et la remise du bon.' | tr }}</p>
        </div>
        <app-gift-form />
      </div>
    </section>

    <app-cta />
  `,
})
export class GiftPage {
  protected readonly booking = inject(BookingService);
  private readonly doc = inject(DOCUMENT);

  protected readonly steps = [
    { title: mark('Choisissez'), text: mark('Un ou plusieurs soins de notre carte, ou le montant de votre choix.') },
    { title: mark('Personnalisez'), text: mark('L’occasion, le prénom de la personne choisie et le vôtre : le bon se compose en direct.') },
    { title: mark('Offrez'), text: mark('Nous vous contactons pour le règlement, puis remettons le bon, valable 12 mois.') },
  ];

  constructor() {
    const seo = inject(SeoService);
    const i18n = inject(I18nService);
    seo.set({
      ...seo.page('/carte-cadeau'),
      path: '/carte-cadeau',
      breadcrumb: i18n.tr('Carte cadeau'),
      jsonLd: [seo.webPage('WebPage', '/carte-cadeau', i18n.tr('Carte cadeau OPAAL Beauty Club'), seo.page('/carte-cadeau').description)],
    });
  }

  protected go(event: Event): void {
    event.preventDefault();
    this.doc.getElementById('commande')?.scrollIntoView({ behavior: 'smooth' });
  }
}
