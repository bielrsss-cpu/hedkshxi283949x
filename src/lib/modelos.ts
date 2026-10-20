// Formato dos registros = campos dos arquivos _modelo-*.md, mais as seções do corpo.
// Usado pelos formulários e pela exportação em .md.
import { CONFIG } from './config';

export const SECOES = {
  sessoes: ['O que estudei', 'Pontos-chave (para revisão)', 'Dúvidas', 'Erros desta sessão'],
  erros: ['Enunciado (resumo)', 'O que marquei × gabarito', 'Por que errei', 'Regra certa (literal da lei, quando for Direito)'],
  redacoes: ['Proposta (textos motivadores, resumo)', 'Tese', 'Texto', 'Correção e o que melhorar'],
  simulados: ['Acertos por disciplina', 'Gestão do tempo', 'Erros a levar para o caderno de erros'],
} as const;

export type ColecaoMd = keyof typeof SECOES;

export const PASTAS: Record<ColecaoMd, string> = {
  sessoes: '04-sessoes',
  erros: '05-caderno-de-erros',
  redacoes: '06-redacao',
  simulados: '07-simulados',
};

export interface Sessao {
  data: string;
  inicio: string;
  duracao_min: number;
  semana: string;
  tipo: string;
  disciplina: string;
  topico: string;
  lei_seca: string[];
  questoes: { feitas: number; acertos: number; fonte: string };
  tarefa_cronograma: string;
  concluida: boolean;
  revisar_em: string[];
}

export interface Erro {
  data: string;
  disciplina: string;
  assunto: string;
  origem: string;
  lei_seca: string;
  tipo_de_erro: string;
  revisoes: number;
  dominado: boolean;
}

export interface Redacao {
  numero: number;
  data: string;
  tema: string;
  tempo_min: number;
  linhas: number;
  /** Uma chave por critério de concurso.config.json (redacao.criterios) + total */
  nota_estimada: Record<string, number | null>;
  corrigida_por: string;
}

export interface Bloco { acertos: number; total: number; minimo?: number; meta?: number }
export interface Simulado {
  numero: number;
  data: string;
  prova: string;
  tempo_total_min: number;
  /** Uma chave por bloco de concurso.config.json (objetiva.blocos[].id), mais total e nota_0_a_10 */
  resultado: Record<string, any> & { total: Bloco; nota_0_a_10: number };
  redacao_nota_estimada: number | null;
}

/** Ordem dos campos no front matter, igual à dos modelos. */
export const ORDEM: Record<ColecaoMd, string[]> = {
  sessoes: ['data', 'inicio', 'duracao_min', 'semana', 'tipo', 'disciplina', 'topico', 'lei_seca', 'questoes', 'tarefa_cronograma', 'concluida', 'revisar_em'],
  erros: ['data', 'disciplina', 'assunto', 'origem', 'lei_seca', 'tipo_de_erro', 'revisoes', 'dominado'],
  redacoes: ['numero', 'data', 'tema', 'tempo_min', 'linhas', 'nota_estimada', 'corrigida_por'],
  simulados: ['numero', 'data', 'prova', 'tempo_total_min', 'resultado', 'redacao_nota_estimada'],
};

export const SIMULADO_DISCIPLINAS: [string, string, number][] = CONFIG.disciplinas
  .filter(([k]) => CONFIG.objetiva.questoes_por_disciplina[k])
  .map(([k, n]) => [k, n, CONFIG.objetiva.questoes_por_disciplina[k]]);

// ---------- YAML no estilo dos modelos ----------

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function escalar(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  if (DATA.test(s)) return s;
  // Palavras simples ficam sem aspas, como nos modelos (semana: S01, tipo: lei-seca)
  if (/^[A-Za-z][A-Za-z0-9_-]*$/.test(s) && !/^(true|false|null|yes|no|on|off|y|n)$/i.test(s)) return s;
  return JSON.stringify(s);
}

function soEscalares(o: Record<string, unknown>) {
  return Object.values(o).every((v) => v === null || typeof v !== 'object');
}

function yaml(obj: Record<string, unknown>, ordem: string[] | null, nivel = 0): string {
  const pad = '  '.repeat(nivel);
  const chaves = ordem ? [...ordem, ...Object.keys(obj).filter((k) => !ordem.includes(k))] : Object.keys(obj);
  const out: string[] = [];
  for (const k of chaves) {
    if (!(k in obj)) continue;
    const v = obj[k];
    if (Array.isArray(v)) {
      if (!v.length) out.push(`${pad}${k}: []`);
      else out.push(`${pad}${k}:`, ...v.map((x) => `${pad}  - ${escalar(x)}`));
    } else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (nivel >= 1 && soEscalares(o)) {
        out.push(`${pad}${k}: { ${Object.entries(o).map(([a, b]) => `${a}: ${escalar(b) || 'null'}`).join(', ')} }`);
      } else {
        out.push(`${pad}${k}:`, yaml(o, null, nivel + 1));
      }
    } else {
      const e = escalar(v);
      out.push(e ? `${pad}${k}: ${e}` : `${pad}${k}:`);
    }
  }
  return out.join('\n');
}

export function paraMarkdown(col: ColecaoMd, fm: Record<string, unknown>, secoes: Record<string, string> = {}): string {
  const corpo = SECOES[col]
    .map((t) => `## ${t}\n\n${(secoes[t] ?? '').trim()}\n`)
    .join('\n');
  return `---\n${yaml(fm, ORDEM[col])}\n---\n\n${corpo}`;
}
