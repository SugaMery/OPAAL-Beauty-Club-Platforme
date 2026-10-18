import { HighlightDirective, MagneticDirective, ParallaxDirective, RevealDirective, TiltDirective } from './fx.directives';
import { SparklesDirective } from './sparkles.directive';

export { FxService } from './fx.service';
export { splitWords } from './fx.directives';

/** Toutes les directives d'animation, à importer dans les composants de page. */
export const FX = [RevealDirective, ParallaxDirective, TiltDirective, MagneticDirective, HighlightDirective, SparklesDirective] as const;
