import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './site';
import { BlogPost } from './models';
import { I18nService, trActive } from './i18n';

export interface NewsletterRequest {
  email: string;
  name: string;
  website: string;
}

export interface MessageRequest {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  website: string;
}

export interface ReviewRequest {
  name: string;
  rating: number;
  text: string;
  service: string;
  website: string;
}

export interface SendResult {
  ok: boolean;
  confirmation_email?: boolean;
}

/** Indique la langue affichée à l'API (messages d'erreur, e-mails de confirmation dans la bonne langue). */
export const langInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE + '/')) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'X-Lang': inject(I18nService).lang() } }));
};

/** Envoi des formulaires publics (contact, avis, newsletter), dans la langue du site. */
@Injectable({ providedIn: 'root' })
export class PublicApi {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);

  newsletter(body: NewsletterRequest): Promise<SendResult> {
    return firstValueFrom(this.http.post<SendResult>(`${API_BASE}/newsletter`, { ...body, lang: this.i18n.siteLang() }));
  }

  blog(): Promise<BlogPost[]> {
    return firstValueFrom(this.http.get<BlogPost[]>(`${API_BASE}/blog`));
  }

  post(slug: string): Promise<BlogPost> {
    return firstValueFrom(this.http.get<BlogPost>(`${API_BASE}/blog/${encodeURIComponent(slug)}`));
  }

  contact(body: MessageRequest): Promise<SendResult> {
    return firstValueFrom(this.http.post<SendResult>(`${API_BASE}/messages`, { ...body, lang: this.i18n.siteLang() }));
  }

  review(body: ReviewRequest): Promise<SendResult> {
    return firstValueFrom(this.http.post<SendResult>(`${API_BASE}/reviews`, { ...body, lang: this.i18n.siteLang() }));
  }
}

/** Message d'erreur lisible à partir d'une réponse de l'API (dans la langue affichée). */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return trActive('Connexion impossible. Vérifiez votre connexion internet et réessayez.');
    }
    const body = err.error as { error?: string } | null;
    if (body && typeof body.error === 'string') {
      return body.error;
    }
    return trActive('Une erreur est survenue ({status}). Merci de réessayer.', { status: err.status });
  }
  return trActive('Une erreur est survenue. Merci de réessayer.');
}

export function fieldErrors(err: unknown): Record<string, string> {
  if (err instanceof HttpErrorResponse && err.error && typeof err.error === 'object' && err.error.fields) {
    return err.error.fields as Record<string, string>;
  }
  return {};
}
