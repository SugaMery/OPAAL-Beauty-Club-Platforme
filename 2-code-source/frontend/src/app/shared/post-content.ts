import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Block, parseBlocks } from '../core/markup';

/** Texte d'un article (ou aperçu dans l'espace propriétaire), rendu sans innerHTML. */
@Component({
  selector: 'app-post-content',
  imports: [RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (b of blocks(); track $index) {
      @switch (b.kind) {
        @case ('h2') {<h2 [id]="b.id">@for (x of b.parts; track $index) {<ng-container [ngTemplateOutlet]="inline" [ngTemplateOutletContext]="{ $implicit: x }" />}</h2>}
        @case ('h3') {<h3 [id]="b.id">@for (x of b.parts; track $index) {<ng-container [ngTemplateOutlet]="inline" [ngTemplateOutletContext]="{ $implicit: x }" />}</h3>}
        @case ('img') {<figure><img [src]="b.src" [alt]="b.alt" loading="lazy" />@if (b.alt) {<figcaption>{{ b.alt }}</figcaption>}</figure>}
        @case ('ul') {<ul>@for (it of b.items; track $index) {<li>@for (x of it; track $index) {<ng-container [ngTemplateOutlet]="inline" [ngTemplateOutletContext]="{ $implicit: x }" />}</li>}</ul>}
        @case ('p') {<p>@for (line of b.lines; track $index; let last = $last) {@for (x of line; track $index) {<ng-container [ngTemplateOutlet]="inline" [ngTemplateOutletContext]="{ $implicit: x }" />}@if (!last) {<br />}}</p>}
      }
    }
    <ng-template #inline let-x>
      @switch (x.t) {
        @case ('b') {<strong>{{ x.text }}</strong>}
        @case ('a') {
          @if (x.path) {<a [routerLink]="x.path" [fragment]="x.fragment">{{ x.text }}</a>} @else {<a [href]="x.href" target="_blank" rel="noopener">{{ x.text }}</a>}
        }
        @default {<ng-container>{{ x.text }}</ng-container>}
      }
    </ng-template>
  `,
})
export class PostContentComponent {
  readonly text = input('');
  protected readonly blocks = computed<Block[]>(() => parseBlocks(this.text()));
}
