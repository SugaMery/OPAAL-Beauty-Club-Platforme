import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

const KEY = 'opaal-admin';

interface Session {
  token: string;
  email: string;
  expires_at: string;
}

/** Session de l'espace propriétaire (jeton conservé dans le navigateur). */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly session = signal<Session | null>(this.read());
  readonly token = computed(() => this.session()?.token ?? null);
  readonly email = computed(() => this.session()?.email ?? '');
  readonly loggedIn = computed(() => !!this.token());

  save(s: Session): void {
    this.session.set(s);
    if (this.isBrowser) {
      try {
        localStorage.setItem(KEY, JSON.stringify(s));
      } catch {
        /* stockage indisponible : la session reste en mémoire */
      }
    }
  }

  clear(): void {
    this.session.set(null);
    if (this.isBrowser) {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
    }
  }

  private read(): Session | null {
    if (!this.isBrowser) {
      return null;
    }
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Session | null;
      if (s?.token && (!s.expires_at || new Date(s.expires_at.replace(' ', 'T')) > new Date())) {
        return s;
      }
    } catch {
      /* ignore */
    }
    return null;
  }
}

/** Ajoute le jeton aux appels /api/admin et renvoie vers la connexion si la session a expiré. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/admin/')) {
    return next(req);
  }
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authReq).pipe(
    catchError((err: unknown) => {
      const publicCall = /\/api\/admin\/(login|forgot|reset)$/.test(req.url);
      if (err instanceof HttpErrorResponse && err.status === 401 && !publicCall) {
        auth.clear();
        void router.navigate(['/admin/connexion'], { queryParams: { expire: 1 } });
      }
      return throwError(() => err);
    }),
  );
};

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.loggedIn() ? true : inject(Router).createUrlTree(['/admin/connexion']);
};
