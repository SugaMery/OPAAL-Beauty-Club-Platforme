/**
 * Mise en forme simple des articles (même syntaxe que dans l'éditeur de l'espace propriétaire) :
 * « ## » intertitre, « ### » sous-titre, « - » liste, « ![texte](image) » image,
 * **gras**, [texte](lien) et liens https:// cliquables. Rendu sans innerHTML (aucun risque d'injection).
 */
export type Inline =
  | { t: 'text'; text: string }
  | { t: 'b'; text: string }
  | { t: 'a'; text: string; href: string; path?: string; fragment?: string };

export type Block =
  | { kind: 'h2' | 'h3'; id: string; parts: Inline[] }
  | { kind: 'p'; lines: Inline[][] }
  | { kind: 'ul'; items: Inline[][] }
  | { kind: 'img'; src: string; alt: string };

const IMG = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Lien autorisé : page du site, https:// ou mailto:. */
function safeHref(url: string): string {
  const u = url.trim();
  return /^(https?:\/\/|mailto:|\/)/i.test(u) ? u : '';
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: 'text', text: text.slice(last, m.index) });
    if (m[1] !== undefined) {
      out.push({ t: 'b', text: m[1] });
    } else if (m[2] !== undefined) {
      const href = safeHref(m[3]);
      if (!href) {
        out.push({ t: 'text', text: m[2] });
      } else if (href.startsWith('/')) {
        const [path, fragment] = href.split('#');
        out.push({ t: 'a', text: m[2], href, path: path || '/', fragment });
      } else {
        out.push({ t: 'a', text: m[2], href });
      }
    } else {
      out.push({ t: 'a', text: m[4], href: m[4] });
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ t: 'text', text: text.slice(last) });
  return out;
}

export function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of content.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/)) {
    let lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    while (lines.length) {
      const l = lines[0];
      const h = /^(#{2,3})\s+(.+)$/.exec(l);
      const img = IMG.exec(l);
      if (h) {
        blocks.push({ kind: h[1].length === 2 ? 'h2' : 'h3', id: slugify(h[2]), parts: parseInline(h[2]) });
      } else if (img) {
        const src = img[2].replace(/^\//, '');
        if (/^(images|uploads)\//.test(src) || /^https:\/\//.test(src)) blocks.push({ kind: 'img', src, alt: img[1] });
      } else {
        break;
      }
      lines = lines.slice(1);
    }
    if (!lines.length) continue;
    if (lines.every((l) => /^[-•]\s+/.test(l))) {
      blocks.push({ kind: 'ul', items: lines.map((l) => parseInline(l.replace(/^[-•]\s+/, ''))) });
    } else {
      blocks.push({ kind: 'p', lines: lines.map(parseInline) });
    }
  }
  return blocks;
}
