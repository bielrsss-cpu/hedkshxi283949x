// Listas usadas pelo site inteiro (servidor e navegador). Os valores vêm de concurso.config.json.
import { CONFIG } from './config';

export const DISCIPLINAS = CONFIG.disciplinas;
export type Disciplina = string;
export const NOME_DISCIPLINA: Record<string, string> = Object.fromEntries(DISCIPLINAS);

export const TIPOS_SESSAO = ['lei-seca', 'teoria', 'questoes', 'revisao', 'redacao', 'simulado'] as const;

export const TIPOS_ERRO = [
  ['nao-sabia', 'Não sabia'],
  ['pegadinha', 'Pegadinha'],
  ['leitura-apressada', 'Leitura apressada'],
  ['confusao-entre-artigos', 'Confusão entre artigos'],
  ['calculo', 'Cálculo'],
  ['tempo', 'Tempo'],
] as const;

export const ETIQUETAS: Record<string, string> = Object.fromEntries(
  Object.entries(CONFIG.cronograma.etiquetas).map(([k, v]) => [k, v.nome]),
);

/** Disciplina de uma norma: campo "disciplina" do front matter do arquivo de lei seca. */
export function disciplinaDaTarefa(etiqueta: string, texto: string, disciplinaDoLink?: string): Disciplina | '' {
  if (disciplinaDoLink) return disciplinaDoLink;
  const e = CONFIG.cronograma.etiquetas[etiqueta];
  if (e?.disciplina) return e.disciplina;
  for (const [d, re] of Object.entries(CONFIG.cronograma.palavras_chave)) {
    if (new RegExp(re, 'i').test(texto)) return d;
  }
  return '';
}

export function tipoDaTarefa(etiqueta: string, link?: string): string {
  const e = CONFIG.cronograma.etiquetas[etiqueta];
  if (e?.tipo) return e.tipo;
  if (link) return 'lei-seca';
  return 'teoria';
}

export const DATA_PROVA = CONFIG.prova.data;
