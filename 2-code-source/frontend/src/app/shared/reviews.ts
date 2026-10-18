import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FX, FxService } from '../core/fx';
import { ContentService } from '../core/content.service';
import { PublicApi, errorMessage } from '../core/api.service';
import { ArrowComponent, StarsComponent } from './ui';
import { I18N, I18nService, mark } from '../core/i18n';

/** Avis clientes (accueil) : carrousel des derniers avis validés + liens vers la page Avis. */
@Component({
  selector: 'app-reviews',
  imports: [RouterLink, StarsComponent, ArrowComponent, FX, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section temoignages center">
      <div class="container">
        <p class="eyebrow center" data-anim="fade">{{ 'Avis clientes' | tr }}</p>
        <h2 class="h2" data-split>{{ 'Elles en parlent mieux que nous' | tr }}</h2>
        @if (all().length) {
          <p class="rating-summary" data-anim="fade"><app-stars [rating]="rounded()" /> <span>{{ average() }} / 5 · {{ (all().length === 1 ? '1 avis' : '{n} avis') | tr: { n: all().length } }}</span></p>
          <div data-anim="up" style="--d: 0.3s">
            <div class="t-slider">
              @for (r of reviews(); track r.id; let i = $index) {
                <blockquote class="t-slide" [class.active]="i === index()">
                  <span class="qmark" aria-hidden="true">“</span>
                  <p>{{ r.text }}</p>
                  <footer><app-stars [rating]="r.rating" /> — {{ r.name }}@if (r.service) {<span class="t-service"> · {{ r.service }}</span>}</footer>
                </blockquote>
              }
            </div>
            @if (reviews().length > 1) {
              <div class="t-dots">
                @for (r of reviews(); track r.id; let i = $index) {
                  <button type="button" [class.active]="i === index()" [attr.aria-label]="'Avis {n}' | tr: { n: i + 1 }" (click)="go(i)"></button>
                }
              </div>
            }
          </div>
        } @else {
          <p class="lead center-lead" data-anim="up">{{ 'Vous êtes venue chez OPAAL ? Partagez votre expérience : votre avis aide d’autres clientes à nous découvrir.' | tr }}</p>
        }
        <div class="review-cta btn-row center-row" data-anim="up" style="--d: 0.4s">
          <a class="btn btn-outline" [routerLink]="'/avis' | lp">{{ 'Laisser un avis' | tr }} <app-arrow /></a>
          @if (all().length) {<a class="link-arrow" [routerLink]="'/avis' | lp" fragment="tous-les-avis">{{ 'Voir tous les avis' | tr }} <app-arrow /></a>}
        </div>
      </div>
    </section>
  `,
})
export class ReviewsComponent {
  private readonly content = inject(ContentService);
  private readonly fx = inject(FxService);
  protected readonly all = this.content.reviews;
  /** Les 12 avis les plus récents défilent sur l'accueil. */
  protected readonly reviews = computed(() => this.all().slice(0, 12));
  private readonly i18n = inject(I18nService);
  protected readonly average = computed(() => this.content.averageRating().toLocaleString(this.i18n.locale()));
  protected readonly rounded = computed(() => Math.round(this.content.averageRating()));
  protected readonly index = signal(0);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const id = setInterval(() => {
        const n = this.reviews().length;
        if (n > 1 && !this.fx.reducedMotion) {
          this.index.update((i) => (i + 1) % n);
        }
      }, 6500);
      destroyRef.onDestroy(() => clearInterval(id));
    });
  }

  protected go(i: number): void {
    this.index.set(i);
  }
}

/** Formulaire « Laisser un avis » (page Avis), pré-rempli par le lien envoyé à la cliente. */
@Component({
  selector: 'app-review-form',
  imports: [ReactiveFormsModule, ArrowComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sent()) {
      <div class="form-success" role="status">
        <div class="success-mark" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" pathLength="1" /><path d="M15 27l7 7 15-16" pathLength="1" /></svg></div>
        <h3>{{ 'Merci {name} !' | tr: { name: form.controls.name.value } }}</h3>
        <p>{{ 'Votre avis nous touche beaucoup. Il sera publié sur le site après une rapide vérification.' | tr }}</p>
        @if (google() && form.controls.rating.value >= 4) {
          <p class="review-google-hint">{{ 'Vous avez 30 secondes ? Publiez aussi votre avis sur Google : c’est ce qui aide le plus d’autres clientes à nous trouver.' | tr }}</p>
          <a class="btn btn-dark" [href]="google()" target="_blank" rel="noopener">{{ 'Publier aussi sur Google' | tr }} <app-arrow /></a>
        }
      </div>
    } @else {
      <form class="wa-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="rating-input" role="radiogroup" [attr.aria-label]="'Votre note' | tr">
          @for (n of [1, 2, 3, 4, 5]; track n) {
            <button type="button" role="radio" [attr.aria-checked]="form.controls.rating.value === n" [attr.aria-label]="(n > 1 ? '{n} étoiles' : '{n} étoile') | tr: { n: n }"
                    [class.on]="n <= form.controls.rating.value" (click)="form.controls.rating.setValue(n)">★</button>
          }
        </div>
        <p class="rating-word" aria-live="polite">{{ words[form.controls.rating.value] | tr }}</p>
        <div class="row">
          <label>{{ 'Prénom' | tr }}<input formControlName="name" autocomplete="given-name" /></label>
          <label>{{ 'Soin reçu' | tr }} <em>{{ '(optionnel)' | tr }}</em>
            <select formControlName="service">
              <option value="">—</option>
              @for (o of options(); track o) {<option [value]="o">{{ o }}</option>}
            </select>
          </label>
        </div>
        <label>{{ 'Votre avis' | tr }}<textarea formControlName="text" rows="5" [placeholder]="'Racontez-nous votre expérience : l’accueil, le soin, le résultat…' | tr"></textarea></label>
        <input class="hp" formControlName="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
        @if (error()) {<p class="form-error" role="alert">{{ error() }}</p>}
        <button class="btn btn-dark btn-block" type="submit" [disabled]="busy()">{{ (busy() ? 'Envoi…' : 'Publier mon avis') | tr }} <app-arrow /></button>
        <p class="form-note">{{ 'Seuls votre prénom, votre note et votre texte sont publiés.' | tr }}</p>
      </form>
    }
  `,
})
export class ReviewFormComponent {
  readonly prefillName = input('');
  readonly prefillService = input('');

  private readonly content = inject(ContentService);
  private readonly api = inject(PublicApi);
  protected readonly sent = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private readonly i18n = inject(I18nService);
  protected readonly words = ['', mark('Décevant'), mark('Moyen'), mark('Bien'), mark('Très bien'), mark('Excellent')];
  protected readonly google = computed(() => this.content.settings().google_review_url || '');
  /** Catégories et soins de la carte, + le soin reçu dans le lien s'il n'y figure pas. */
  protected readonly options = computed(() => {
    const list = this.content.categories().flatMap((c) => [c.title, ...c.services.map((s) => s.name)]);
    const pre = this.prefillService().trim();
    return pre && !list.includes(pre) ? [pre, ...list] : list;
  });
  protected readonly form = inject(FormBuilder).nonNullable.group({
    rating: [5, [Validators.min(1), Validators.max(5)]],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    service: [''],
    text: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
    website: [''],
  });

  constructor() {
    effect(() => {
      const name = this.prefillName().trim();
      const service = this.prefillService().trim();
      if (name && !this.form.controls.name.value) this.form.controls.name.setValue(name.slice(0, 60));
      if (service) this.form.controls.service.setValue(service.slice(0, 120));
    });
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set(this.i18n.tr('Indiquez votre prénom et un avis d’au moins 10 caractères.'));
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.review(this.form.getRawValue());
      this.sent.set(true);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
