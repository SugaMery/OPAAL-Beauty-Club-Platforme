import { ChangeDetectionStrategy, Component, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorMessage } from '../core/api.service';
import { SITE_PHOTOS } from '../core/media-slots';
import { AdminApi, MediaItem } from './admin-api';
import { AdmIconComponent, Toaster } from './admin-shared';
import { ADMIN_I18N } from './admin-i18n';
import { trActive } from '../core/i18n';

export interface Picked {
  src: string;
  alt: string;
}

/**
 * Prépare une photo avant l'envoi : redimensionnée à 2400 px maximum et recompressée
 * dans le navigateur (les photos de téléphone de 5 à 10 Mo partent en quelques secondes).
 */
export async function prepareImage(file: File): Promise<{ blob: Blob; name: string }> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error(trActive('Format non accepté ({type}) : envoyez une photo JPEG, PNG ou WebP.', { type: file.type || trActive('inconnu') }));
  }
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 2_500_000 && file.type !== 'image/webp') {
    bmp.close();
    return { blob: file, name: file.name };
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error(trActive('Conversion impossible.')))), type, 0.9));
  return { blob, name: file.name.replace(/\.\w+$/, '') + (type === 'image/png' ? '.png' : '.jpg') };
}

/** Envoie plusieurs photos à la suite et renvoie celles qui sont enregistrées. */
export async function uploadFiles(api: AdminApi, toaster: Toaster, files: FileList | File[]): Promise<MediaItem[]> {
  const done: MediaItem[] = [];
  for (const f of Array.from(files)) {
    try {
      const { blob, name } = await prepareImage(f);
      done.push(await api.uploadMedia(blob, name));
    } catch (e) {
      toaster.error(`« ${f.name} » : ${e instanceof Error && !('status' in e) ? e.message : errorMessage(e)}`);
    }
  }
  if (done.length) toaster.ok(trActive(done.length > 1 ? '{n} images ajoutées à la médiathèque.' : '{n} image ajoutée à la médiathèque.', { n: done.length }));
  return done;
}

/** Ouvre la médiathèque pour choisir une image : `const img = await picker.open()`. */
@Injectable({ providedIn: 'root' })
export class MediaPicker {
  readonly request = signal<{ title: string; resolve: (v: Picked | null) => void } | null>(null);

  open(title = trActive('Choisir une image')): Promise<Picked | null> {
    this.request()?.resolve(null);
    return new Promise((resolve) => this.request.set({ title, resolve }));
  }
}

@Component({
  selector: 'app-media-picker',
  imports: [FormsModule, AdmIconComponent, ADMIN_I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    @if (picker.request(); as req) {
      <div class="adm-modal" role="dialog" aria-modal="true" [attr.aria-label]="req.title" (click)="backdrop($event)">
        <div class="adm-modal-box">
          <header class="adm-modal-head">
            <h2>{{ req.title }}</h2>
            <button type="button" class="adm-icon-btn" [attr.aria-label]="'Fermer' | tr" (click)="close()"><app-adm-icon name="x" /></button>
          </header>
          <div class="adm-modal-tools">
            <div class="adm-tabs" style="margin: 0">
              <button type="button" [class.active]="tab() === 'mine'" (click)="tab.set('mine')">{{ 'Mes images' | tr }} <b>{{ items().length }}</b></button>
              <button type="button" [class.active]="tab() === 'site'" (click)="tab.set('site')">{{ 'Photos du site' | tr }} <b>{{ site.length }}</b></button>
            </div>
            <label class="adm-btn primary adm-upload">
              <app-adm-icon name="plus" /> {{ (uploading() ? 'Envoi…' : 'Envoyer des photos') | tr }}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple (change)="upload($event)" [disabled]="uploading()" />
            </label>
          </div>
          <div class="adm-modal-body" (dragover)="$event.preventDefault()" (drop)="drop($event)">
            @if (tab() === 'mine') {
              @if (loading()) {
                <div class="adm-loading"><span></span><span></span><span></span></div>
              } @else if (!items().length) {
                <p class="adm-empty">{{ 'Aucune image envoyée pour le moment. Cliquez sur « Envoyer des photos » ou glissez-les ici.' | tr }}</p>
              }
              <div class="adm-media-grid">
                @for (m of items(); track m.id) {
                  <button type="button" class="adm-media-tile" (click)="choose(m.url, m.alt)">
                    <img [src]="m.url" [alt]="m.alt" loading="lazy" />
                    <span>{{ m.width }} × {{ m.height }}</span>
                  </button>
                }
              </div>
            } @else {
              <div class="adm-media-grid">
                @for (p of site; track p.src) {
                  <button type="button" class="adm-media-tile" (click)="choose(p.src, p.alt)">
                    <img [src]="p.src" [alt]="p.alt | tr" loading="lazy" />
                    <span>{{ p.alt | tr }}</span>
                  </button>
                }
              </div>
            }
          </div>
          <p class="adm-hint adm-modal-foot">{{ 'Conseil : photos nettes et lumineuses, 1600 px de large minimum. Elles sont automatiquement optimisées pour le web.' | tr }}</p>
        </div>
      </div>
    }
  `,
})
export class MediaPickerComponent {
  protected readonly picker = inject(MediaPicker);
  private readonly api = inject(AdminApi);
  private readonly toaster = inject(Toaster);
  protected readonly site = SITE_PHOTOS;
  protected readonly tab = signal<'mine' | 'site'>('mine');
  protected readonly items = signal<MediaItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly uploading = signal(false);
  private loaded = false;

  constructor() {
    // charge la médiathèque à la première ouverture
    effect(() => {
      if (this.picker.request() && !this.loaded) untracked(() => void this.load());
    });
  }

  private async load(): Promise<void> {
    this.loaded = true;
    this.loading.set(true);
    try {
      this.items.set(await this.api.media());
      if (!this.items().length) this.tab.set('site');
    } catch (e) {
      this.toaster.error(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected choose(src: string, alt: string): void {
    this.picker.request()?.resolve({ src, alt });
    this.picker.request.set(null);
  }

  protected close(): void {
    this.picker.request()?.resolve(null);
    this.picker.request.set(null);
  }

  protected backdrop(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('adm-modal')) this.close();
  }

  protected async upload(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) await this.send(input.files);
    input.value = '';
  }

  protected async drop(e: DragEvent): Promise<void> {
    e.preventDefault();
    if (e.dataTransfer?.files.length) await this.send(e.dataTransfer.files);
  }

  private async send(files: FileList): Promise<void> {
    this.uploading.set(true);
    const added = await uploadFiles(this.api, this.toaster, files);
    this.items.update((l) => [...added, ...l]);
    this.tab.set('mine');
    this.uploading.set(false);
    if (added.length === 1) this.choose(added[0].url, added[0].alt);
  }
}
