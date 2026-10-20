// Leitura dos arquivos .md de caderno/ no momento do build.
// Nada aqui roda no navegador: o resultado vira HTML estático.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import attrs from 'markdown-it-attrs';
import { disciplinaDaTarefa, tipoDaTarefa, type Disciplina } from './disciplinas';

export const RAIZ = path.resolve(process.cwd(), 'caderno');

function novoMd(opts: { breaks?: boolean } = {}) {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: false, breaks: !!opts.breaks });
  md.use(attrs, { allowedAttributes: ['id'] });
  // Links internos ../03-lei-seca/arquivo.md#art-n viram /lei-seca/arquivo#art-n
  const padrao = md.renderer.rules.link_open ?? ((t, i, o, _e, s) => s.renderToken(t, i, o));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet('href');
    if (href) {
      const novo = reescreverLink(href);
      tokens[idx].attrSet('href', novo);
      if (/^https?:/.test(novo)) {
        tokens[idx].attrSet('target', '_blank');
        tokens[idx].attrSet('rel', 'noopener');
      }
    }
    return padrao(tokens, idx, options, env, self);
  };
  return md;
}

export const md = novoMd();
const mdQuebras = novoMd({ breaks: true });

export function reescreverLink(href: string): string {
  const m = href.match(/(?:\.\.\/)*(?:caderno\/)?03-lei-seca\/([\w-]+)\.md(#[\w-]+)?$/);
  if (m) return `/lei-seca/${m[1]}${m[2] ?? ''}`;
  if (/00-edital\/.*\.md$/.test(href)) return '/edital';
  if (/01-analise\/.*\.md$/.test(href)) return '/analise';
  if (/02-cronograma\/.*\.md$/.test(href)) return '/cronograma';
  return href;
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function textoPlano(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- Documentos simples (edital, análise) ----------

export interface ItemIndice { nivel: number; texto: string; id: string }

export function carregarDocumento(rel: string, opts: { quebras?: boolean } = {}) {
  const bruto = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  const { data, content } = matter(bruto);
  const indice: ItemIndice[] = [];
  const usados = new Set<string>();
  // Gera ids para ##/### sem âncora explícita
  const comIds = content.replace(/^(#{2,4})\s+(.+?)\s*$/gm, (linha, h: string, texto: string) => {
    if (/\{#[^}]+\}\s*$/.test(texto)) return linha;
    let id = slugify(texto) || 'secao';
    while (usados.has(id)) id += '-2';
    usados.add(id);
    indice.push({ nivel: h.length, texto, id });
    return `${h} ${texto} {#${id}}`;
  });
  const html = (opts.quebras ? mdQuebras : md).render(comIds);
  return { meta: data as Record<string, any>, html, indice };
}

// ---------- Lei seca ----------

export interface NormaMeta {
  slug: string;
  arquivo: string;
  titulo: string;
  norma?: string;
  recorte_edital?: string;
  item_edital?: string;
  artigos_extraidos?: number;
  fonte_oficial?: string;
  texto_obtido_em?: string;
  status?: string;
  pendente: boolean;
  disciplina: Disciplina;
}

export interface BlocoTitulo { tipo: 'titulo'; nivel: number; texto: string; id: string }
export interface BlocoArtigo { tipo: 'artigo'; id: string; rotulo: string; html: string; texto: string }
export type Bloco = BlocoTitulo | BlocoArtigo;

const DIR_LEI = path.join(RAIZ, '03-lei-seca');

export function listarNormas(): NormaMeta[] {
  return fs
    .readdirSync(DIR_LEI)
    .filter((f) => /^\d\d-.*\.md$/.test(f))
    .sort()
    .map((arquivo) => {
      const { data } = matter(fs.readFileSync(path.join(DIR_LEI, arquivo), 'utf8'));
      const slug = arquivo.replace(/\.md$/, '');
      return {
        slug,
        arquivo,
        ...(data as any),
        titulo: data.titulo ?? slug,
        pendente: String(data.status ?? '').toUpperCase() === 'PENDENTE',
        disciplina: String(data.disciplina ?? ''),
      } as NormaMeta;
    });
}

export function carregarNorma(slug: string) {
  const meta = listarNormas().find((n) => n.slug === slug);
  if (!meta) throw new Error(`Norma não encontrada: ${slug}`);
  const { content } = matter(fs.readFileSync(path.join(DIR_LEI, meta.arquivo), 'utf8'));
  const linhas = content.split('\n');
  const blocos: Bloco[] = [];
  const intro: string[] = [];
  let atual: { id: string; rotulo: string; linhas: string[] } | null = null;
  const usados = new Set<string>();
  let nTitulo = 0;

  const fecharArtigo = () => {
    if (!atual) return;
    const html = md.render(atual.linhas.join('\n'));
    blocos.push({ tipo: 'artigo', id: atual.id, rotulo: atual.rotulo, html, texto: textoPlano(html) });
    atual = null;
  };

  for (const linha of linhas) {
    const h = linha.match(/^(#{1,6})\s+(.*?)\s*(?:\{#([^}]+)\})?\s*$/);
    if (h) {
      const nivel = h[1].length;
      const texto = h[2];
      const ancora = h[3];
      if (nivel === 1) continue; // o título da página vem do front matter
      if (nivel === 6 && ancora) {
        fecharArtigo();
        let id = ancora;
        while (usados.has(id)) id += '-b';
        usados.add(id);
        atual = { id, rotulo: texto, linhas: [] };
        continue;
      }
      if (blocos.length === 0 && !atual && /^(Fonte oficial|Tarefa para)/i.test(texto)) {
        intro.push(linha);
        continue;
      }
      fecharArtigo();
      blocos.push({ tipo: 'titulo', nivel, texto, id: `t${++nTitulo}-${slugify(texto)}` });
      continue;
    }
    if (atual) (atual as { linhas: string[] }).linhas.push(linha);
    else if (blocos.length === 0) intro.push(linha);
  }
  fecharArtigo();

  return { meta, introHtml: md.render(intro.join('\n')), blocos };
}

// ---------- Cronograma ----------

export interface Tarefa {
  id: string;
  semana: string;
  etiqueta: string;
  texto: string;
  link?: string;
  disciplina: Disciplina | '';
  tipo: string;
  feitaNoArquivo: boolean;
}

export interface Semana {
  id: string;
  titulo: string;
  inicio: string; // AAAA-MM-DD
  fim: string;
  fase: string;
  tarefas: Tarefa[];
}

function dataISO(dm: string, anoPadrao: string): string {
  const [d, m, a] = dm.split('/');
  return `${a ?? anoPadrao}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function discDoLink(link?: string): string | undefined {
  const m = link?.match(/\/lei-seca\/([\w-]+)/);
  return m ? listarNormas().find((n) => n.slug === m[1])?.disciplina || undefined : undefined;
}

export function carregarCronograma() {
  const bruto = fs.readFileSync(path.join(RAIZ, '02-cronograma/cronograma.md'), 'utf8');
  const { data, content } = matter(bruto);
  const semanas: Semana[] = [];
  const prazos: Tarefa[] = [];
  const introLinhas: string[] = [];
  let semana: Semana | null = null;
  let emPrazos = false;

  for (const linha of content.split('\n')) {
    const h = linha.match(/^##\s+(S\d\d)\s+·\s+(.+?)\s+·\s+(.+)$/);
    if (h) {
      const [ini, fim] = h[2].split(/\s+[–-]\s+/);
      const anoFim = fim.split('/')[2];
      let inicio = dataISO(ini, anoFim);
      const fimISO = dataISO(fim, anoFim);
      if (inicio > fimISO) inicio = dataISO(ini, String(Number(anoFim) - 1));
      semana = { id: h[1], titulo: linha.replace(/^##\s+/, ''), inicio, fim: fimISO, fase: h[3], tarefas: [] };
      semanas.push(semana);
      emPrazos = false;
      continue;
    }
    if (/^##\s+Prazos/.test(linha)) emPrazos = true;
    else if (/^##\s+/.test(linha)) emPrazos = false;

    const t = linha.match(/^- \[( |x|X)\] `([A-Z/]+)` (.+)$/);
    if (t && (semana || emPrazos)) {
      let texto = t[3];
      let link: string | undefined;
      const l = texto.match(/\s*→\s*\[[^\]]*\]\(([^)]+)\)\s*$/);
      if (l) {
        link = reescreverLink(l[1]);
        texto = texto.slice(0, l.index).trim();
      }
      const lista = semana ? semana.tarefas : prazos;
      const id = semana ? `${semana.id}-${lista.length + 1}` : `PRAZO-${lista.length + 1}`;
      lista.push({
        id,
        semana: semana?.id ?? '',
        etiqueta: t[2],
        texto,
        link,
        disciplina: disciplinaDaTarefa(t[2], texto, discDoLink(link)),
        tipo: tipoDaTarefa(t[2], link),
        feitaNoArquivo: t[1] !== ' ',
      });
      continue;
    }
    if (!semana && !emPrazos && !/^---\s*$/.test(linha)) introLinhas.push(linha);
  }

  return {
    meta: data as Record<string, any>,
    introHtml: md.render(introLinhas.join('\n').replace(/^#\s+.*$/m, '')),
    semanas,
    prazos,
    bruto,
  };
}
