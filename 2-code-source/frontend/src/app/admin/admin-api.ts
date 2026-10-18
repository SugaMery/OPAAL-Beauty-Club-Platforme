import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../core/site';
import { BlogPost, Category, LegalSection, Offer, PageSeo, Service, Settings } from '../core/models';

export type MessageStatus = 'nouveau' | 'lu' | 'traite';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface Message {
  id: number;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: MessageStatus;
  admin_note: string;
  created_at: string;
  /** Langue du site utilisé par la cliente. */
  lang?: string;
}

export interface AdminReview {
  id: number;
  name: string;
  rating: number;
  text: string;
  service: string;
  source?: string;
  status: ReviewStatus;
  created_at: string;
  lang?: string;
}

export type ReviewInput = Partial<AdminReview> & { date?: string };

export interface MailLog {
  to_addr: string;
  subject: string;
  status: string;
  error: string;
  created_at: string;
}

export interface Dashboard {
  counts: {
    booking_clicks_7: number;
    booking_clicks_30: number;
    whatsapp_clicks_30: number;
    messages_new: number;
    messages_total: number;
    reviews_pending: number;
    reviews_approved: number;
    offers_active: number;
    services_priced: number;
    services_total: number;
    subscribers: number;
    subscribers_30: number;
    posts_published: number;
    posts_draft: number;
  };
  booking_days: { date: string; count: number }[];
  top_booked: { label: string; n: number }[];
  checklist: Record<'password_changed' | 'hours' | 'socials' | 'prices' | 'email_ok' | 'legal' | 'booking_url' | 'blog', boolean>;
  seo_files: Record<string, string>;
  messages: Message[];
  mail_log: MailLog[];
}

export interface SmtpSettings {
  host: string;
  port: number;
  encryption: 'ssl' | 'tls' | 'none';
  username: string;
  password?: string;
  from_email: string;
  from_name: string;
  has_password?: boolean;
  notify_email?: string;
}

export interface Subscriber {
  id: number;
  email: string;
  name: string;
  status: 'active' | 'unsubscribed';
  source: string;
  created_at: string;
  unsubscribed_at: string | null;
  /** Langue des e-mails reçus (fr / en). */
  lang: string;
}

export interface CampaignStats {
  total: number;
  sent: number;
  failed: number;
  remaining: number;
}

export interface Campaign {
  id: number;
  subject: string;
  heading: string;
  body: string;
  button_label: string;
  button_url: string;
  /** Image principale de l'e-mail (images/… ou uploads/…). */
  image: string;
  /** Version anglaise (envoyée aux abonnées anglophones si objet et texte sont remplis). */
  subject_en: string;
  heading_en: string;
  body_en: string;
  button_label_en: string;
  button_url_en: string;
  status: 'draft' | 'sending' | 'sent';
  created_at: string;
  sent_at: string | null;
  stats: CampaignStats;
}

export type CampaignInput = Pick<
  Campaign,
  'subject' | 'heading' | 'body' | 'button_label' | 'button_url' | 'image' | 'subject_en' | 'heading_en' | 'body_en' | 'button_label_en' | 'button_url_en'
>;

export interface SeoState {
  overrides: Record<string, PageSeo>;
  defaults: Record<string, PageSeo>;
  /** Pages anglaises (/en/…), rangées par adresse française. */
  overrides_en: Record<string, PageSeo>;
  defaults_en: Record<string, PageSeo>;
  files: Record<string, 'ok' | 'updated' | 'absent' | 'readonly'>;
}

export interface MediaItem {
  id: number;
  url: string;
  name: string;
  alt: string;
  width: number;
  height: number;
  size: number;
  created_at: string;
}

export type ImageMap = Record<string, { src?: string; alt?: string; alt_en?: string; pos?: string }>;

export interface InboxItem {
  seq: number;
  uid: number;
  seen: boolean;
  from: string;
  from_email: string;
  subject: string;
  date: string;
  size: number;
}

export interface InboxMessage {
  uid: number;
  from: string;
  from_email: string;
  to: string;
  subject: string;
  date: string;
  text: string;
  attachments: { name: string; type: string }[];
  message_id: string;
}

export interface PostInput {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  cover: string;
  cover_alt: string;
  seo_title: string;
  seo_description: string;
  status: 'draft' | 'published';
  published_at: string;
  title_en: string;
  excerpt_en: string;
  content_en: string;
  category_en: string;
  cover_alt_en: string;
  seo_title_en: string;
  seo_description_en: string;
}

/** Appels de l'espace propriétaire. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/admin`;
  /** Compteurs affichés dans le menu (messages non lus, avis en attente). */
  readonly badges = signal({ messages: 0, reviews: 0 });

  private get<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(this.base + path));
  }
  private send<T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
    return firstValueFrom(this.http.request<T>(method, this.base + path, { body }));
  }

  login(email: string, password: string) {
    return this.send<{ token: string; email: string; expires_at: string }>('POST', '/login', { email, password });
  }
  forgot(email: string) {
    return this.send<{ ok: boolean }>('POST', '/forgot', { email });
  }
  reset(token: string, password: string) {
    return this.send<{ token: string; expires_at: string }>('POST', '/reset', { token, password });
  }
  logout() {
    return this.send<{ ok: boolean }>('POST', '/logout');
  }
  me() {
    return this.get<{ email: string }>('/me');
  }

  async dashboard(light = false): Promise<Dashboard> {
    const d = await this.get<Dashboard>('/dashboard' + (light ? '?light=1' : ''));
    this.badges.set({ messages: d.counts.messages_new, reviews: d.counts.reviews_pending });
    return d;
  }
  async refreshBadges(): Promise<void> {
    try {
      await this.dashboard(true);
    } catch {
      /* ignore */
    }
  }

  messages() {
    return this.get<Message[]>('/messages');
  }
  updateMessage(id: number, body: Partial<Message>) {
    return this.send<Message>('PATCH', `/messages/${id}`, body);
  }
  deleteMessage(id: number) {
    return this.send<{ ok: boolean }>('DELETE', `/messages/${id}`);
  }

  reviews() {
    return this.get<AdminReview[]>('/reviews');
  }
  addReview(body: ReviewInput) {
    return this.send<{ ok: boolean; id: number }>('POST', '/reviews', body);
  }
  updateReview(id: number, body: ReviewInput) {
    return this.send<{ ok: boolean }>('PATCH', `/reviews/${id}`, body);
  }
  /** E-mail « Votre avis compte » envoyé à une cliente (en français ou en anglais). */
  requestReview(body: { email: string; name: string; service: string; lang: string }) {
    return this.send<{ ok: boolean; error: string }>('POST', '/reviews/request', body);
  }
  deleteReview(id: number) {
    return this.send<{ ok: boolean }>('DELETE', `/reviews/${id}`);
  }

  catalog() {
    return this.get<Category[]>('/catalog');
  }
  updateCategory(id: number, body: { title: string; intro: string; title_en: string; intro_en: string }) {
    return this.send<{ ok: boolean }>('PUT', `/categories/${id}`, body);
  }
  createService(body: Partial<Service>) {
    return this.send<Service>('POST', '/services', body);
  }
  updateService(id: number, body: Partial<Service>) {
    return this.send<Service>('PUT', `/services/${id}`, body);
  }
  deleteService(id: number) {
    return this.send<{ ok: boolean }>('DELETE', `/services/${id}`);
  }

  offers() {
    return this.get<Offer[]>('/offers');
  }
  createOffer(body: Partial<Offer>) {
    return this.send<Offer>('POST', '/offers', body);
  }
  updateOffer(id: number, body: Partial<Offer>) {
    return this.send<Offer>('PUT', `/offers/${id}`, body);
  }
  deleteOffer(id: number) {
    return this.send<{ ok: boolean }>('DELETE', `/offers/${id}`);
  }

  settings() {
    return this.get<Settings>('/settings');
  }
  saveSettings(body: Partial<Settings>) {
    return this.send<Settings>('PUT', '/settings', body);
  }

  changePassword(current: string, password: string) {
    return this.send<{ ok: boolean }>('POST', '/password', { current, password });
  }

  /* E-mails (SMTP) */
  smtp() {
    return this.get<SmtpSettings>('/smtp');
  }
  saveSmtp(body: SmtpSettings) {
    return this.send<SmtpSettings>('PUT', '/smtp', body);
  }
  /** E-mail de test ; avec `smtp`, teste ces réglages sans les enregistrer. */
  testEmail(to = '', smtp?: SmtpSettings) {
    return this.send<{ ok: boolean; to: string; error: string }>('POST', '/test-email', { to, ...(smtp ? { smtp } : {}) });
  }
  mailLog() {
    return this.get<MailLog[]>('/mail-log');
  }

  /* Pages & SEO */
  seo() {
    return this.get<SeoState>('/seo');
  }
  saveSeo(pages: Record<string, PageSeo>, pagesEn: Record<string, PageSeo>) {
    return this.send<SeoState>('PUT', '/seo', { pages, pages_en: pagesEn });
  }
  /** Mentions légales d'une langue (liste vide = textes par défaut). */
  saveLegal(sections: LegalSection[], lang: string) {
    return this.send<{ ok: boolean; sections: LegalSection[] }>('PUT', '/legal', { sections, lang });
  }

  /* Newsletter */
  subscribers() {
    return this.get<Subscriber[]>('/subscribers');
  }
  importSubscribers(emails: string, lang = 'fr') {
    return this.send<{ added: number; existing: number; invalid: string[] }>('POST', '/subscribers', { emails, lang });
  }
  updateSubscriber(id: number, body: Partial<Subscriber>) {
    return this.send<{ ok: boolean }>('PATCH', `/subscribers/${id}`, body);
  }
  deleteSubscriber(id: number) {
    return this.send<{ ok: boolean }>('DELETE', `/subscribers/${id}`);
  }
  campaigns() {
    return this.get<Campaign[]>('/campaigns');
  }
  createCampaign(body: CampaignInput) {
    return this.send<Campaign>('POST', '/campaigns', body);
  }
  updateCampaign(id: number, body: CampaignInput) {
    return this.send<Campaign>('PUT', `/campaigns/${id}`, body);
  }
  deleteCampaign(id: number) {
    return this.send<{ ok: boolean }>('DELETE', `/campaigns/${id}`);
  }
  previewCampaign(body: CampaignInput, lang = 'fr') {
    return this.send<{ html: string }>('POST', '/campaigns/preview', { ...body, lang });
  }
  testCampaign(id: number, to: string, lang = 'fr') {
    return this.send<{ ok: boolean; error: string }>('POST', `/campaigns/${id}/test`, { to, lang });
  }
  sendCampaignBatch(id: number) {
    return this.send<CampaignStats & { done: boolean; last_error: string }>('POST', `/campaigns/${id}/send`);
  }
  retryCampaign(id: number) {
    return this.send<Campaign>('POST', `/campaigns/${id}/retry`);
  }

  /* Boîte de réception (IMAP) */
  inbox(page = 1) {
    return this.get<{ total: number; unseen: number; page: number; pages: number; items: InboxItem[] }>(`/inbox?page=${page}`);
  }
  inboxMessage(uid: number) {
    return this.get<InboxMessage>(`/inbox/${uid}`);
  }
  replyEmail(body: { to: string; subject: string; text: string; in_reply_to: string }) {
    return this.send<{ ok: boolean; error: string }>('POST', '/inbox/reply', body);
  }

  /* Médiathèque & images du site */
  media() {
    return this.get<MediaItem[]>('/media');
  }
  uploadMedia(file: Blob, name: string, alt = '') {
    const form = new FormData();
    form.append('file', file, name);
    form.append('alt', alt);
    return firstValueFrom(this.http.post<MediaItem>(this.base + '/media', form));
  }
  updateMedia(id: number, alt: string) {
    return this.send<MediaItem>('PATCH', `/media/${id}`, { alt });
  }
  deleteMedia(id: number) {
    return this.send<{ ok: boolean }>('DELETE', `/media/${id}`);
  }
  saveImages(images: ImageMap) {
    return this.send<{ images: ImageMap; files: Record<string, string> }>('PUT', '/images', { images });
  }
  saveCollection(key: 'gallery' | 'feed', items: { src: string; caption: string; caption_en?: string; cat: string }[] | null) {
    return this.send<{ items: { src: string; caption: string; caption_en?: string; cat: string; w: number; h: number }[] | null }>(
      'PUT', `/${key}`, items === null ? { reset: true } : { items },
    );
  }

  /* Blog */
  posts() {
    return this.get<BlogPost[]>('/posts');
  }
  post(id: number) {
    return this.get<BlogPost>(`/posts/${id}`);
  }
  createPost(body: PostInput) {
    return this.send<BlogPost>('POST', '/posts', body);
  }
  updatePost(id: number, body: PostInput) {
    return this.send<BlogPost>('PUT', `/posts/${id}`, body);
  }
  deletePost(id: number) {
    return this.send<{ ok: boolean }>('DELETE', `/posts/${id}`);
  }
}
