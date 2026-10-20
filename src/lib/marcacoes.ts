// Marcações da lei seca: um registro por artigo, sem tocar no texto da lei.
import { listar, salvar, type Registro } from './dados';

export type EstadoArtigo = '' | 'lido' | 'revisar' | 'dominado';

export interface Grifo { i: number; f: number; txt: string }

export interface Marcacao {
  norma: string;
  artigo: string;
  estado: EstadoArtigo;
  grifos: Grifo[];
  nota: string;
  vezes_em_prova: number;
  atualizado_em: string;
}

export const idMarcacao = (norma: string, artigo: string) => `${norma}__${artigo}`;

export function vazia(norma: string, artigo: string): Marcacao {
  return { norma, artigo, estado: '', grifos: [], nota: '', vezes_em_prova: 0, atualizado_em: '' };
}

export async function marcacoesDaNorma(norma: string): Promise<Map<string, Marcacao>> {
  const todos = (await listar<Marcacao>('marcacoes')) as Registro<Marcacao>[];
  const m = new Map<string, Marcacao>();
  for (const r of todos) if (r.fm.norma === norma) m.set(r.fm.artigo, { ...vazia(norma, r.fm.artigo), ...r.fm });
  return m;
}

export async function salvarMarcacao(m: Marcacao) {
  m.atualizado_em = new Date().toISOString();
  await salvar('marcacoes', idMarcacao(m.norma, m.artigo), m);
}

export const ROTULO_ESTADO: Record<EstadoArtigo, string> = {
  '': 'Sem marcação',
  lido: 'Lido',
  revisar: 'Revisar',
  dominado: 'Dominado',
};
