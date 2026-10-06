// Blog posts live in content/blog/*.md: a front-matter block, then a small Markdown subset.
// Supported: ## / ### headings, paragraphs, "- " bullets, "> " pull quotes, pipe tables,
// **bold**, [text](url), and {{products: slug, slug}} which embeds real catalog products with images.
import { readdir, readFile } from 'node:fs/promises';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const inline = s => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`);

function frontMatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error('missing front matter');
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2] };
}

// renderProducts(slugs) -> html; supplied by the build so cards use real catalog data.
export function renderPost(src, renderProducts) {
  const { meta, body } = frontMatter(src);
  for (const k of ['title', 'slug', 'description', 'date', 'hero']) if (!meta[k]) throw new Error(`front matter needs ${k}`);
  const lines = body.split(/\r?\n/);
  const html = [], headings = [], used = new Set(), text = [];
  let para = [], list = [], table = [];
  const flush = () => {
    if (para.length) { html.push(`<p>${inline(para.join(' '))}</p>`); text.push(para.join(' ')); para = []; }
    if (list.length) { html.push(`<ul>${list.map(li => `<li>${inline(li)}</li>`).join('')}</ul>`); text.push(...list); list = []; }
    if (table.length) {
      const rows = table.filter(r => !/^\|?\s*:?-{2,}/.test(r)).map(r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
      const [head, ...rest] = rows;
      html.push(`<div class="table-wrap"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rest.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      table = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    let m;
    if (!line) { flush(); continue; }
    if ((m = line.match(/^\{\{products:\s*(.+?)\s*\}\}$/))) {
      flush();
      const slugs = m[1].split(',').map(s => s.trim()).filter(Boolean);
      slugs.forEach(s => used.add(s));
      html.push(renderProducts(slugs));
      continue;
    }
    if ((m = line.match(/^(#{2,3})\s+(.+)$/))) {
      flush();
      const level = m[1].length, t = m[2], id = slugify(t);
      if (level === 2) headings.push({ id, text: t });
      html.push(`<h${level} id="${id}">${inline(t)}</h${level}>`);
      text.push(t);
      continue;
    }
    if (line.startsWith('> ')) { flush(); html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`); text.push(line.slice(2)); continue; }
    if (line.startsWith('- ')) { if (para.length || table.length) flush(); list.push(line.slice(2)); continue; }
    if (line.startsWith('|')) { if (para.length || list.length) flush(); table.push(line); continue; }
    if (list.length || table.length) flush();
    para.push(line);
  }
  flush();
  const words = text.join(' ').split(/\s+/).filter(Boolean).length;
  return { meta, html: html.join('\n'), headings, used: [...used], words };
}

export async function loadPosts(dir, renderProducts) {
  let files = [];
  try { files = (await readdir(dir)).filter(f => f.endsWith('.md')); } catch { return []; }
  const posts = [];
  for (const f of files) posts.push(renderPost(await readFile(`${dir}/${f}`, 'utf8'), renderProducts));
  const slugs = posts.map(p => p.meta.slug);
  const dup = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (dup) throw new Error(`duplicate blog slug: ${dup}`);
  return posts.sort((a, b) => b.meta.date.localeCompare(a.meta.date) || a.meta.title.localeCompare(b.meta.title));
}
