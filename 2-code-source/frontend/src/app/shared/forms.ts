import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PublicApi, errorMessage, fieldErrors } from '../core/api.service';
import { I18N, I18nService, mark } from '../core/i18n';
import { ArrowComponent } from './ui';

const PHONE = /^[+0-9 ().-]{8,25}$/;

/** Sujets du formulaire de contact (enregistrés en français pour la propriétaire, affichés traduits). */
const SUBJECTS = [
  mark('Question sur un soin'),
  mark('Club OPAAL / membership'),
  mark('Carte cadeau'),
  mark('Événement / groupe'),
  mark('Autre demande'),
];

/** Inscription à la newsletter (pied de page). */
@Component({
  selector: 'app-newsletter-form',
  imports: [ReactiveFormsModule, RouterLink, ArrowComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="footer-news" aria-labelledby="news-title">
      <div class="footer-news-text">
        <p class="eyebrow">{{ 'Newsletter' | tr }}</p>
        <h3 id="news-title">{{ 'Nos offres & nouveautés, en avant-première' | tr }}</h3>
      </div>
      @if (sent()) {
        <p class="footer-news-ok" role="status">{{ 'Merci ! Vous êtes inscrite. Un e-mail de bienvenue vous a été envoyé.' | tr }}</p>
      } @else {
        <form class="footer-news-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label class="sr-only" for="news-email">{{ 'Votre adresse e-mail' | tr }}</label>
          <input id="news-email" formControlName="email" type="email" autocomplete="email" [placeholder]="'Votre adresse e-mail' | tr" [class.invalid]="error()" />
          <input class="hp" formControlName="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
          <button class="btn btn-dark" type="submit" [disabled]="busy()">{{ (busy() ? 'Envoi…' : 'Je m’inscris') | tr }} <app-arrow /></button>
          @if (error()) {<p class="form-error" role="alert">{{ error() }}</p>}
          <p class="form-note">{{ 'Désinscription en un clic à tout moment.' | tr }} <a [routerLink]="'/mentions-legales' | lp" fragment="confidentialite">{{ 'Confidentialité' | tr }}</a></p>
        </form>
      }
    </section>
  `,
})
export class NewsletterFormComponent {
  private readonly api = inject(PublicApi);
  private readonly i18n = inject(I18nService);
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    website: [''],
  });

  protected async submit(): Promise<void> {
    this.error.set('');
    if (this.form.invalid) {
      this.error.set(this.i18n.tr('Indiquez une adresse e-mail valide.'));
      return;
    }
    this.busy.set(true);
    try {
      await this.api.newsletter({ ...this.form.getRawValue(), name: '' });
      this.sent.set(true);
    } catch (e) {
      this.error.set(fieldErrors(e)['email'] ?? errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}

/** Formulaire de contact (page Contact). */
@Component({
  selector: 'app-contact-form',
  imports: [ReactiveFormsModule, ArrowComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sent()) {
      <div class="form-success" role="status">
        <div class="success-mark" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" pathLength="1" /><path d="M15 27l7 7 15-16" pathLength="1" /></svg></div>
        <h3>{{ 'Message envoyé' | tr }}</h3>
        <p>{{ 'Merci ! Nous avons bien reçu votre message et vous répondons très vite. Un e-mail de confirmation vous a été envoyé.' | tr }}</p>
        <button type="button" class="link-arrow" (click)="again()">{{ 'Envoyer un autre message' | tr }} <app-arrow /></button>
      </div>
    } @else {
      <form class="wa-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="row">
          <label>{{ 'Nom complet' | tr }}
            <input formControlName="name" autocomplete="name" [class.invalid]="bad('name')" />
            @if (bad('name')) {<small class="err">{{ err('name', 'Indiquez votre nom.') }}</small>}
          </label>
          <label>{{ 'E-mail' | tr }}
            <input formControlName="email" type="email" autocomplete="email" [class.invalid]="bad('email')" />
            @if (bad('email')) {<small class="err">{{ err('email', 'Adresse e-mail invalide.') }}</small>}
          </label>
        </div>
        <div class="row">
          <label>{{ 'Téléphone' | tr }} <em>{{ '(optionnel)' | tr }}</em>
            <input formControlName="phone" type="tel" autocomplete="tel" [class.invalid]="bad('phone')" />
            @if (bad('phone')) {<small class="err">{{ err('phone', 'Numéro invalide.') }}</small>}
          </label>
          <label>{{ 'Sujet' | tr }}
            <select formControlName="subject">
              @for (o of subjects; track o) {<option [value]="o">{{ o | tr }}</option>}
            </select>
          </label>
        </div>
        <label>{{ 'Message' | tr }}
          <textarea formControlName="message" rows="5" [class.invalid]="bad('message')"></textarea>
          @if (bad('message')) {<small class="err">{{ err('message', 'Votre message doit contenir au moins 10 caractères.') }}</small>}
        </label>
        <input class="hp" formControlName="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
        @if (error()) {<p class="form-error" role="alert">{{ error() }}</p>}
        <button class="btn btn-dark btn-block" type="submit" [disabled]="busy()">
          {{ (busy() ? 'Envoi en cours…' : 'Envoyer le message') | tr }} <app-arrow />
        </button>
        <p class="form-note">{{ 'Vos informations servent uniquement à vous répondre.' | tr }}</p>
      </form>
    }
  `,
})
export class ContactFormComponent {
  private readonly api = inject(PublicApi);
  private readonly i18n = inject(I18nService);
  protected readonly subjects = SUBJECTS;
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal('');
  private readonly serverErrors = signal<Record<string, string>>({});
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    phone: ['', [Validators.pattern(PHONE)]],
    subject: [SUBJECTS[0]],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(3000)]],
    website: [''],
  });

  constructor() {
    // Lien « Nous écrire » de la page Carte cadeau : /contact?sujet=carte-cadeau
    if (inject(ActivatedRoute).snapshot.queryParamMap.get('sujet') === 'carte-cadeau') {
      this.form.controls.subject.setValue(SUBJECTS[2]);
    }
  }

  protected bad(name: string): boolean {
    const c = this.form.get(name);
    return (!!c && c.invalid && (c.touched || c.dirty)) || !!this.serverErrors()[name];
  }

  protected err(name: string, fallback: string): string {
    return this.serverErrors()[name] ?? this.i18n.tr(fallback);
  }

  protected again(): void {
    this.form.reset();
    this.sent.set(false);
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    this.serverErrors.set({});
    if (this.form.invalid) {
      this.error.set(this.i18n.tr('Merci de vérifier les champs en rouge.'));
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.contact(this.form.getRawValue());
      this.sent.set(true);
    } catch (e) {
      this.serverErrors.set(fieldErrors(e));
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
