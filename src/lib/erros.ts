import { obter, salvar } from './dados';
import { hoje } from './datas';
import { SECOES, type Erro } from './modelos';

export interface NovoErro {
  fm: Partial<Erro>;
  enunciado?: string;
  marquei?: string;
  correta?: string;
  porque?: string;
  regra?: string;
}

const [S_ENUNC, S_GAB, S_PORQUE, S_REGRA] = SECOES.erros;

export function montarSecoes(e: NovoErro): Record<string, string> {
  return {
    [S_ENUNC]: e.enunciado ?? '',
    [S_GAB]: `- Marquei: ${e.marquei ?? ''}\n- Correta: ${e.correta ?? ''}`,
    [S_PORQUE]: e.porque ?? '',
    [S_REGRA]: e.regra ? e.regra.split('\n').map((l) => `> ${l}`).join('\n') : '> ',
  };
}

export function lerSecoes(secoes: Record<string, string> = {}) {
  const gab = secoes[S_GAB] ?? '';
  return {
    enunciado: secoes[S_ENUNC] ?? '',
    marquei: gab.match(/Marquei:\s*(.*)/)?.[1]?.trim() ?? '',
    correta: gab.match(/Correta:\s*(.*)/)?.[1]?.trim() ?? '',
    porque: secoes[S_PORQUE] ?? '',
    regra: (secoes[S_REGRA] ?? '').split('\n').map((l) => l.replace(/^>\s?/, '')).join('\n').trim(),
  };
}

export async function registrarErro(e: NovoErro, idExistente?: string): Promise<string> {
  const fm: Erro = {
    data: hoje(),
    disciplina: '',
    assunto: '',
    origem: '',
    lei_seca: '',
    tipo_de_erro: 'nao-sabia',
    revisoes: 0,
    dominado: false,
    ...e.fm,
  };
  let id = idExistente;
  if (!id) {
    const d = new Date();
    const hms = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join('');
    id = `${fm.data}-${hms}-${fm.disciplina || 'geral'}`;
    if (await obter('erros', id)) id += `-${Math.random().toString(36).slice(2, 6)}`;
  }
  await salvar('erros', id, fm, montarSecoes(e));
  return id;
}
