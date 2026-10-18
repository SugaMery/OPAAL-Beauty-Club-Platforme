import { DOCUMENT, Injectable, PLATFORM_ID, computed, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ContentService } from './content.service';
import { whatsappHref } from './format';
import { API_BASE } from './site';

export const DEFAULT_BOOKING_URL = 'https://dikidi.net/1891924';

/**
 * Prise de rendez-vous : tous les boutons « Réserver » ouvrent l'agenda en ligne (Dikidi).
 * Le lien est modifiable dans l'espace propriétaire (Coordonnées). Chaque clic est compté
 * (sans cookie ni donnée personnelle) pour les statistiques du tableau de bord.
 */
@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly content = inject(ContentService);
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly url = computed(() => this.content.settings().booking_url || DEFAULT_BOOKING_URL);

  /** Lien WhatsApp avec un message pré-rempli. */
  whatsapp(text: string): string {
    return whatsappHref(this.content.settings(), text);
  }

  track(label = '', type: 'booking' | 'whatsapp' = 'booking'): void {
    if (!this.isBrowser) return;
    const body = JSON.stringify({ type, label, page: this.doc.location.pathname });
    try {
      const sent = navigator.sendBeacon?.(`${API_BASE}/track`, new Blob([body], { type: 'application/json' }));
      if (!sent) {
        void fetch(`${API_BASE}/track`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
      }
    } catch {
      /* statistique facultative */
    }
  }
}
