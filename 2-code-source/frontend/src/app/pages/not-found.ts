import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FX } from '../core/fx';
import { SeoService } from '../core/seo.service';
import { I18N, I18nService } from '../core/i18n';
import { ArrowComponent, MonoComponent } from '../shared/ui';

@Component({
  selector: 'app-not-found',
  imports: [FX, RouterLink, ArrowComponent, MonoComponent, I18N],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-hero simple not-found">
      <div class="ghost-word" data-parallax-x=".12" aria-hidden="true">404</div>
      <div class="container center">
        <div class="draw nf-mono"><app-mono /></div>
        <p class="eyebrow center" data-anim="fade">{{ 'Erreur 404' | tr }}</p>
        <h1 data-split>{{ 'Cette page s’est' | tr }} <em>{{ 'éclipsée.' | tr }}</em></h1>
        <p class="lead" data-anim="up" style="--d: 0.3s">{{ 'La page demandée n’existe pas ou a été déplacée.' | tr }}</p>
        <div class="btn-row center-row" data-anim="up" style="--d: 0.45s">
          <a class="btn btn-dark" [routerLink]="'/' | lp">{{ 'Retour à l’accueil' | tr }} <app-arrow /></a>
          <a class="link-arrow" [routerLink]="'/soins' | lp">{{ 'Nos soins' | tr }} <app-arrow /></a>
        </div>
      </div>
    </section>
  `,
})
export class NotFoundPage {
  constructor() {
    const i18n = inject(I18nService);
    inject(SeoService).set({
      title: i18n.tr('Page introuvable | OPAAL Beauty Club'),
      description: i18n.tr('La page demandée est introuvable.'),
      path: '/404',
      noindex: true,
    });
  }
}
