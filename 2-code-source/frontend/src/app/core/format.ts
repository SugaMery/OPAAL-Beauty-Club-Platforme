import { Service, Settings } from './models';
import type { Lang } from './i18n';

/** « 450 DH », « À partir de 450 DH » ou « Sur demande » (en anglais : « From 450 DH », « On request »). */
export function formatPrice(service: Pick<Service, 'price' | 'price_from'>, currency = 'DH', lang: Lang = 'fr'): string {
  const en = lang === 'en';
  if (service.price === null || service.price === undefined) {
    return en ? 'On request' : 'Sur demande';
  }
  const amount = en
    ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(service.price)
    : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(service.price).replace(/ /g, ' ');
  return `${service.price_from ? (en ? 'From ' : 'À partir de ') : ''}${amount} ${currency}`;
}

/** « 1 h 30 », « 45 min » (en anglais : « 1 hr 30 min »). */
export function formatDuration(minutes: number | null, lang: Lang = 'fr'): string {
  if (!minutes) {
    return '';
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) {
    return `${m} min`;
  }
  if (lang === 'en') {
    return m ? `${h} hr ${m} min` : `${h} hr`;
  }
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** Numéro au format international pour les liens tel: (06… → +2126…). */
export function telHref(phone: string): string {
  let digits = (phone || '').replace(/[^\d+]/g, '');
  if (/^0\d{9}$/.test(digits)) {
    digits = '+212' + digits.slice(1);
  }
  return 'tel:' + digits;
}

export function whatsappHref(settings: Pick<Settings, 'whatsapp' | 'phone'>, text = ''): string {
  let digits = (settings.whatsapp || settings.phone || '').replace(/\D/g, '');
  if (/^0\d{9}$/.test(digits)) {
    digits = '212' + digits.slice(1);
  }
  return `https://wa.me/${digits}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}

export function fullAddress(s: Settings): string {
  return [s.address_line1, s.address_line2, s.city, s.country].filter(Boolean).join(', ');
}

export function stars(rating: number): string {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}
