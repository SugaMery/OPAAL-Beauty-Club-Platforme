import { DestroyRef, Directive, ElementRef, NgZone, afterNextRender, inject } from '@angular/core';
import { FxService } from './fx.service';

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  a: number;
  s: number;
  z: number;
}

/** Particules dorées scintillantes (canvas class="sparkles", data-density="0.6"). */
@Directive({ selector: 'canvas.sparkles' })
export class SparklesDirective {
  constructor() {
    const canvas = inject<ElementRef<HTMLCanvasElement>>(ElementRef).nativeElement;
    const fx = inject(FxService);
    const zone = inject(NgZone);
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      if (fx.reducedMotion) {
        return;
      }
      const ctx = canvas.getContext('2d');
      const host = canvas.parentElement;
      if (!ctx || !host) {
        return;
      }
      const win = canvas.ownerDocument.defaultView!;
      const density = parseFloat(canvas.getAttribute('data-density') ?? '') || 1;
      let W = 0;
      let H = 0;
      let parts: Particle[] = [];
      let mx = 0;
      let my = 0;
      let visible = true;
      let running = false;
      let destroyed = false;

      const make = (): Particle => ({
        x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.7 + 0.4,
        vy: -(Math.random() * 0.28 + 0.05), vx: (Math.random() - 0.5) * 0.14,
        a: Math.random() * 6.28, s: Math.random() * 0.025 + 0.008, z: Math.random() * 0.8 + 0.2,
      });
      const size = () => {
        const dpr = Math.min(win.devicePixelRatio || 1, 2);
        W = canvas.clientWidth;
        H = canvas.clientHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const n = Math.round(Math.min(80, (W * H) / 15000) * density);
        parts = Array.from({ length: n }, make);
      };
      const frame = () => {
        if (!visible || destroyed) {
          running = false;
          return;
        }
        ctx.clearRect(0, 0, W, H);
        for (const p of parts) {
          p.x += p.vx;
          p.y += p.vy;
          p.a += p.s;
          if (p.y < -12) {
            p.y = H + 12;
            p.x = Math.random() * W;
          }
          const tw = (Math.sin(p.a) + 1) / 2;
          const x = p.x + mx * p.z * 18;
          const y = p.y + my * p.z * 18;
          const R = p.r * 5;
          const g = ctx.createRadialGradient(x, y, 0, x, y, R);
          g.addColorStop(0, `rgba(236,214,156,${(0.85 * tw).toFixed(3)})`);
          g.addColorStop(1, 'rgba(200,169,93,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, R, 0, 6.283);
          ctx.fill();
          if (p.r > 1.55 && tw > 0.8) {
            ctx.strokeStyle = `rgba(236,214,156,${(tw * 0.75).toFixed(3)})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(x - R * 1.4, y);
            ctx.lineTo(x + R * 1.4, y);
            ctx.moveTo(x, y - R * 1.4);
            ctx.lineTo(x, y + R * 1.4);
            ctx.stroke();
          }
        }
        requestAnimationFrame(frame);
      };
      const start = () => {
        if (!running && visible && !destroyed) {
          running = true;
          requestAnimationFrame(frame);
        }
      };

      zone.runOutsideAngular(() => {
        size();
        const onResize = () => size();
        win.addEventListener('resize', onResize);
        const onMove = (e: PointerEvent) => {
          const r = host.getBoundingClientRect();
          mx = (e.clientX - r.left) / r.width - 0.5;
          my = (e.clientY - r.top) / r.height - 0.5;
          host.style.setProperty('--mx', mx.toFixed(3));
          host.style.setProperty('--my', my.toFixed(3));
        };
        host.addEventListener('pointermove', onMove);
        const io = new IntersectionObserver((entries) => {
          visible = entries[0]?.isIntersecting ?? true;
          start();
        });
        io.observe(host);
        start();
        destroyRef.onDestroy(() => {
          destroyed = true;
          io.disconnect();
          win.removeEventListener('resize', onResize);
          host.removeEventListener('pointermove', onMove);
        });
      });
    });
  }
}
