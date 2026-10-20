// Configuração do concurso (concurso.config.json). Usada no build e no navegador.
import bruto from '../../concurso.config.json';

export interface Bloco { id: string; nome: string; total: number; minimo?: number; disciplinas: string[] }
export interface Criterio { id: string; nome: string; dica?: string }

export const CONFIG = bruto as unknown as {
  id: string;
  nome_site: string;
  orgao: string;
  cargo: string;
  banca: string;
  edital: string;
  prova: { data: string; descricao: string; duracao_min: number };
  disciplinas: [string, string][];
  objetiva: { total: number; meta: number; nota_max: number; blocos: Bloco[]; questoes_por_disciplina: Record<string, number> };
  redacao: { existe: boolean; nota_max: number; minimo: number; criterios: Criterio[]; avisos_linhas: { ate: number; tipo: string; texto: string }[] };
  estudo: { minutos_por_dia: number; pomodoro_dias_uteis: number; pomodoro_fim_de_semana: number; pausa: number };
  cronograma: {
    etiquetas: Record<string, { nome: string; disciplina?: string; tipo?: string }>;
    palavras_chave: Record<string, string>;
  };
};

/** Prefixo das chaves do navegador (localStorage, IndexedDB, cache). */
export const PREFIXO = CONFIG.id || 'caderno';

export const blocoDaDisciplina = (d: string) => CONFIG.objetiva.blocos.find((b) => b.disciplinas.includes(d));

/** Texto de origem de uma questão de prova, usado no caderno de erros. */
export const origemQuestao = (banca: string, ano: string, n?: number) =>
  `${banca} ${ano} · ${CONFIG.orgao} · ${CONFIG.cargo}${n ? ` · Q${String(n).padStart(2, '0')}` : ''}`;
