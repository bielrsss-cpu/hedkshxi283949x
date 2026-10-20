// Leitura dos arquivos 08-provas/AAAA-questoes.md no build.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { md, RAIZ, reescreverLink, textoPlano } from './conteudo';

export interface Alternativa { letra: string; html: string; texto: string }
export interface Questao {
  n: number;
  id: string; // q01
  disciplina: string;
  assunto: string;
  gabarito: string;
  lei: string; // 03-lei-seca/…md#art-n (como no caderno de erros)
  leiLink: string; // /lei-seca/…#art-n
  texto: string; // id do texto de apoio
  html: string;
  enunciado: string; // texto plano
  alternativas: Alternativa[];
}
export interface Prova {
  ano: string;
  meta: Record<string, any>;
  textos: Record<string, { titulo: string; html: string }>;
  questoes: Questao[];
}

const DIR = path.join(RAIZ, '08-provas');

export function listarProvas(): Prova[] {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => /^\d{4}-questoes\.md$/.test(f))
    .sort()
    .reverse()
    .map((f) => carregarProva(f));
}

function carregarProva(arquivo: string): Prova {
  const { data, content } = matter(fs.readFileSync(path.join(DIR, arquivo), 'utf8'));
  const ano = arquivo.slice(0, 4);
  const textos: Prova['textos'] = {};
  const questoes: Questao[] = [];
  // Divide em blocos por títulos ## (texto) e ### (questão)
  const blocos = content.split(/^(?=##+ )/m);
  let textoAtual = '';
  let fimTexto = 0;
  for (const b of blocos) {
    const t = b.match(/^## (Texto para as questões (\d+) a (\d+)) \{#([\w-]+)\}\s*\n([\s\S]*)$/);
    if (t) {
      textos[t[4]] = { titulo: t[1], html: md.render(t[5].trim()) };
      textoAtual = t[4];
      fimTexto = Number(t[3]);
      continue;
    }
    const q = b.match(/^### Q(\d+) \{#(q\d+)\}\s*\n([^\n]*)\n([\s\S]*)$/);
    if (!q) continue;
    const n = Number(q[1]);
    const meta = Object.fromEntries(
      q[3].split(' · ').map((p) => {
        const i = p.indexOf(':');
        return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
      }),
    );
    const corpo = q[4].trim();
    const iAlt = corpo.search(/^- \(A\) /m);
    const enunciadoMd = corpo.slice(0, iAlt).trim();
    const alternativas = [...corpo.slice(iAlt).matchAll(/^- \(([A-E])\) (.*)$/gm)].map((m) => {
      const html = md.renderInline(m[2]);
      return { letra: m[1], html, texto: textoPlano(html) };
    });
    const html = md.render(enunciadoMd);
    const lei = meta.lei ?? '';
    questoes.push({
      n,
      id: q[2],
      disciplina: meta.disciplina ?? '',
      assunto: meta.assunto ?? '',
      gabarito: meta.gabarito ?? '',
      lei,
      leiLink: lei ? reescreverLink(lei) : '',
      texto: n <= fimTexto ? textoAtual : '',
      html,
      enunciado: textoPlano(html),
      alternativas,
    });
  }
  return { ano, meta: data, textos, questoes };
}
