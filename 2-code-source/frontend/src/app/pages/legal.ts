import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FX } from '../core/fx';
import { ContentService } from '../core/content.service';
import { SeoService } from '../core/seo.service';
import { DEFAULT_LEGAL, DEFAULT_LEGAL_EN, legalBlocks, legalVars } from '../core/legal-default';
import { I18N, I18nService } from '../core/i18n';
import { pickLegal } from '../core/localize';

@Component({
  selector: 'app-legal',
  imports: [FX, RouterLink, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-hero simple">
      <div class="ghost-word" data-parallax-x=".12" aria-hidden="true">{{ 'Légal' | tr }}</div>
      <div class="container">
        <div>
          <nav class="breadcrumb" data-anim="fade" [attr.aria-label]="'Fil d’Ariane' | tr"><a [routerLink]="'/' | lp">{{ 'Accueil' | tr }}</a><i></i><span>{{ 'Mentions légales' | tr }}</span></nav>
          <p class="eyebrow line" data-anim="fade" style="--d: 0.1s">{{ 'Informations' | tr }}</p>
          <h1 data-split>{{ 'Mentions' | tr }} <em>{{ 'légales' | tr }}</em> {{ '& conditions' | tr }}</h1>
        </div>
      </div>
    </section>
    <!-- Textes modifiables dans l'espace propriétaire : Pages & SEO → Mentions & conditions (français et anglais). -->
    <section class="section" style="padding-top: 70px">
      <div class="container prose" data-anim="up">
        @for (sec of sections(); track $index) {
          <h2 [id]="sec.id || null">{{ sec.title }}</h2>
          @for (b of sec.blocks; track $index) {
            @if (b.kind === 'ul') {
              <ul>@for (it of b.items; track $index) {<li>{{ it }}</li>}</ul>
            } @else {
              <p class="pre-line">{{ b.text }}</p>
            }
          }
        }
      </div>
    </section>
  `,
})
export class LegalPage {
  private readonly content = inject(ContentService);
  private readonly i18n = inject(I18nService);
  protected readonly sections = computed(() => {
    const s = this.content.settings();
    const list = pickLegal(this.content.rawSettings(), this.i18n.siteLang(), { fr: DEFAULT_LEGAL, en: DEFAULT_LEGAL_EN });
    return list.map((sec) => ({ id: sec.id, title: sec.title, blocks: legalBlocks(legalVars(sec.body, s)) }));
  });

  constructor() {
    const seo = inject(SeoService);
    seo.set({
      ...seo.page('/mentions-legales'),
      path: '/mentions-legales',
      breadcrumb: this.i18n.tr('Mentions légales'),
      jsonLd: [seo.webPage('WebPage', '/mentions-legales', this.i18n.tr('Mentions légales & conditions'), seo.page('/mentions-legales').description ?? '')],
    });
  }
}
