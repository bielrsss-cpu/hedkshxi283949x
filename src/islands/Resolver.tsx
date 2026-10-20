import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Prova, Questao } from '../lib/questoes';
import { listar, obter, salvar } from '../lib/dados';
import { useColecao, useParametros } from '../lib/hooks';
import { hoje } from '../lib/datas';
import { DISCIPLINAS, NOME_DISCIPLINA, TIPOS_ERRO } from '../lib/disciplinas';
import { registrarErro } from '../lib/erros';
import type { Erro, Simulado } from '../lib/modelos';
import { SECOES, SIMULADO_DISCIPLINAS } from '../lib/modelos';
import { toast } from '../lib/app';
import { CONFIG, blocoDaDisciplina, origemQuestao } from '../lib/config';
import { nota, resultadoVazio } from './Simulados';

export interface Resposta {
  prova: string;
  questao: number;
  disciplina: string;
  marcada: string;
  correta: string;
  acertou: boolean;
  data: string;
  tentativas: number;
  erro_id?: string;
}

interface Props { prova: Prova }


const anulada = (q: Questao) => !/^[A-E]$/.test(q.gabarito);

export default function Resolver({ prova }: Props) {
  const params = useParametros();
  const respostasReg = useColecao<Resposta>('respostas');
  const respostas = useMemo(() => {
    const m = new Map<number, Resposta>();
    for (const r of respostasReg ?? []) if (r.fm.prova === prova.ano) m.set(r.fm.questao, r.fm);
    return m;
  }, [respostasReg, prova.ano]);

  const [disc, setDisc] = useState(params.get('d') ?? '');
  const [situacao, setSituacao] = useState(params.get('s') ?? '');
  const lista = useMemo(
    () =>
      prova.questoes.filter((q) => {
        if (disc && q.disciplina !== disc) return false;
        const r = respostas.get(q.n);
        if (situacao === 'nao-respondidas') return !r;
        if (situacao === 'erradas') return !!r && !r.acertou;
        if (situacao === 'certas') return !!r && r.acertou;
        return true;
      }),
    // a lista não muda enquanto se responde (senão a questão some ao errar/acertar)
    [disc, situacao, respostasReg === null],
  );
  const [idx, setIdx] = useState(() => {
    const q = Number(params.get('q'));
    const i = lista.findIndex((x) => x.n === q);
    return i >= 0 ? i : 0;
  });
  const [marcada, setMarcada] = useState<string>('');
  const [refazer, setRefazer] = useState(false);
  const [erroInfo, setErroInfo] = useState<{ id: string; tipo: string } | null>(null);
  const [mapaAberto, setMapaAberto] = useState(false);

  useEffect(() => { if (idx >= lista.length) setIdx(Math.max(0, lista.length - 1)); }, [lista.length]);

  const q = lista[idx];
  const resp = q ? respostas.get(q.n) : undefined;
  const respondida = !!resp && !refazer;

  useEffect(() => {
    setMarcada('');
    setRefazer(false);
    setErroInfo(null);
    if (q) {
      const u = new URL(location.href);
      u.searchParams.set('q', String(q.n));
      history.replaceState(null, '', u);
      window.scrollTo({ top: 0 });
    }
  }, [q?.n]);

  const total = prova.questoes.length;
  const feitas = prova.questoes.filter((x) => respostas.has(x.n)).length;
  const certas = prova.questoes.filter((x) => respostas.get(x.n)?.acertou).length;

  const origem = (x: Questao) => origemQuestao(prova.meta.banca ?? CONFIG.banca, prova.ano, x.n);

  const responder = async () => {
    if (!q || !marcada) return;
    const acertou = anulada(q) || marcada === q.gabarito;
    const id = `${prova.ano}-${q.id}`;
    const anterior = (await obter<Resposta>('respostas', id))?.fm;
    let erro_id = anterior?.erro_id;
    if (!acertou) {
      const alt = (l: string) => {
        const a = q.alternativas.find((x) => x.letra === l);
        return a ? `(${l}) ${a.texto}` : l;
      };
      const texto = q.texto ? `[${prova.textos[q.texto]?.titulo}]\n\n` : '';
      const existente = erro_id ? await obter<Erro>('erros', erro_id) : undefined;
      erro_id = await registrarErro(
        {
          fm: {
            ...(existente?.fm ?? {}),
            data: hoje(),
            disciplina: q.disciplina,
            assunto: q.assunto.replace(/-/g, ' '),
            origem: origem(q),
            lei_seca: q.lei,
            tipo_de_erro: existente?.fm.tipo_de_erro ?? 'nao-sabia',
            dominado: false,
          },
          enunciado: texto + q.enunciado,
          marquei: alt(marcada),
          correta: alt(q.gabarito),
        },
        existente ? erro_id : undefined,
      );
      setErroInfo({ id: erro_id, tipo: existente?.fm.tipo_de_erro ?? 'nao-sabia' });
    }
    await salvar<Resposta>('respostas', id, {
      prova: prova.ano,
      questao: q.n,
      disciplina: q.disciplina,
      marcada,
      correta: q.gabarito,
      acertou,
      data: hoje(),
      tentativas: (anterior?.tentativas ?? 0) + 1,
      ...(erro_id ? { erro_id } : {}),
    });
    setRefazer(false);
    if (!acertou) toast('Erro enviado ao caderno de erros');
  };

  const mudarTipo = async (tipo: string) => {
    if (!erroInfo) return;
    const r = await obter<Erro>('erros', erroInfo.id);
    if (r) await salvar('erros', erroInfo.id, { ...r.fm, tipo_de_erro: tipo }, r.secoes);
    setErroInfo({ ...erroInfo, tipo });
  };

  const registrarSimulado = async () => {
    const por: Record<string, number> = {};
    const resultado = resultadoVazio();
    for (const x of prova.questoes) {
      if (respostas.get(x.n)?.acertou) {
        por[x.disciplina] = (por[x.disciplina] ?? 0) + 1;
        const bl = blocoDaDisciplina(x.disciplina);
        if (bl) resultado[bl.id].acertos++;
      }
    }
    const simulados = await listar<Simulado>('simulados');
    const numero = Math.max(0, ...simulados.map((s) => Number(s.fm.numero) || 0)) + 1;
    resultado.total.acertos = CONFIG.objetiva.blocos.reduce((s, bl) => s + resultado[bl.id].acertos, 0);
    resultado.nota_0_a_10 = nota(resultado.total.acertos);
    const fm: Simulado = {
      numero,
      data: hoje(),
      prova: origemQuestao(prova.meta.banca ?? CONFIG.banca, prova.ano),
      tempo_total_min: CONFIG.prova.duracao_min,
      resultado,
      redacao_nota_estimada: null,
    };
    const [S_TAB, S_TEMPO, S_ERROS] = SECOES.simulados;
    const tabela = ['| Disciplina | Acertos | Total |', '|---|---|---|', ...SIMULADO_DISCIPLINAS.map(([k, n, t]) => `| ${n} | ${por[k] ?? 0} | ${t} |`)].join('\n');
    const erradas = prova.questoes.filter((x) => respostas.has(x.n) && !respostas.get(x.n)!.acertou).map((x) => `Q${String(x.n).padStart(2, '0')}`);
    await salvar('simulados', `${hoje()}-simulado-${String(numero).padStart(2, '0')}`, fm, {
      [S_TAB]: tabela,
      [S_TEMPO]: '',
      [S_ERROS]: erradas.length ? `Questões erradas (já no caderno de erros): ${erradas.join(', ')}` : '',
    });
    toast('Simulado registrado');
    location.href = '/simulados';
  };

  const filtros = (
    <div class="cartao">
      <div class="campos">
        <div class="campo">
          <label>Disciplina</label>
          <select value={disc} onChange={(e) => { setDisc((e.target as HTMLSelectElement).value); setIdx(0); }}>
            <option value="">Todas</option>
            {DISCIPLINAS.filter(([k]) => prova.questoes.some((x) => x.disciplina === k)).map(([k, n]) => <option value={k}>{n}</option>)}
          </select>
        </div>
        <div class="campo">
          <label>Situação</label>
          <select value={situacao} onChange={(e) => { setSituacao((e.target as HTMLSelectElement).value); setIdx(0); }}>
            <option value="">Todas</option>
            <option value="nao-respondidas">Não respondidas</option>
            <option value="erradas">Erradas</option>
            <option value="certas">Certas</option>
          </select>
        </div>
      </div>
      <div class="linha entre pequeno">
        <span>{feitas}/{total} respondidas · {certas} acertos{feitas ? ` (${Math.round((certas / feitas) * 100)}%)` : ''}</span>
        <button class="btn-icone pequeno" type="button" onClick={() => setMapaAberto(!mapaAberto)}>{mapaAberto ? 'Fechar mapa' : 'Mapa da prova'}</button>
      </div>
      <div class="barra" style="margin-top:6px"><span style={{ width: `${(feitas / total) * 100}%` }} /></div>
      {mapaAberto && (
        <div class="mapa">
          {prova.questoes.map((x) => {
            const r = respostas.get(x.n);
            const i = lista.findIndex((y) => y.n === x.n);
            return (
              <button
                type="button"
                key={x.n}
                class={`mapa-q ${r ? (r.acertou ? 'certa' : 'errada') : ''} ${q?.n === x.n ? 'atual' : ''}`}
                disabled={i < 0}
                onClick={() => { setIdx(i); setMapaAberto(false); }}
                aria-label={`Questão ${x.n}`}
              >{x.n}</button>
            );
          })}
        </div>
      )}
      {feitas === total && (
        <div class="aviso ok" style="margin-bottom:0">
          Prova completa: {certas}/{total}.
          <button class="btn pequeno" style="margin-left:8px" type="button" onClick={() => void registrarSimulado()}>Registrar como simulado</button>
        </div>
      )}
    </div>
  );

  if (!q) return <div>{filtros}<p class="vazio">Nenhuma questão nesse filtro.</p></div>;

  const texto = q.texto ? prova.textos[q.texto] : null;
  const mostrar = respondida ? resp!.marcada : marcada;

  return (
    <div>
      {filtros}
      <article class="cartao questao">
        <div class="linha entre">
          <strong>Q{String(q.n).padStart(2, '0')}</strong>
          <span class="linha">
            <span class="selo info">{NOME_DISCIPLINA[q.disciplina] ?? q.disciplina}</span>
            <span class="selo">{q.assunto.replace(/-/g, ' ')}</span>
          </span>
        </div>
        {texto && (
          <details class="texto-apoio" open>
            <summary>{texto.titulo}</summary>
            <div class="doc" dangerouslySetInnerHTML={{ __html: texto.html }} />
          </details>
        )}
        <div class="enunciado doc" dangerouslySetInnerHTML={{ __html: q.html }} />
        {anulada(q) && <p class="aviso">Questão anulada no gabarito: qualquer resposta conta como acerto.</p>}
        <div class="alternativas" role="radiogroup" aria-label="Alternativas">
          {q.alternativas.map((a) => {
            let cls = '';
            if (respondida) {
              if (a.letra === q.gabarito) cls = 'certa';
              else if (a.letra === resp!.marcada) cls = 'errada';
            } else if (a.letra === marcada) cls = 'marcada';
            return (
              <button
                key={a.letra}
                type="button"
                role="radio"
                aria-checked={mostrar === a.letra}
                class={`alt ${cls}`}
                disabled={respondida}
                onClick={() => setMarcada(a.letra)}
              >
                <span class="alt-letra">{a.letra}</span>
                <span dangerouslySetInnerHTML={{ __html: a.html }} />
              </button>
            );
          })}
        </div>

        {!respondida ? (
          <button class="btn primario" style="width:100%;margin-top:10px" type="button" disabled={!marcada} onClick={() => void responder()}>Responder</button>
        ) : (
          <div style="margin-top:10px">
            {resp!.acertou ? (
              <p class="aviso ok">Você acertou{resp!.tentativas > 1 ? ` (tentativa ${resp!.tentativas})` : ''}.</p>
            ) : (
              <div class="aviso perigo">
                Gabarito: <strong>{q.gabarito}</strong>. Você marcou {resp!.marcada}. O erro foi para o caderno de erros.
                {(erroInfo || resp!.erro_id) && (
                  <div class="linha" style="margin-top:8px">
                    <label style="margin:0;color:inherit">Tipo de erro:</label>
                    <select style="width:auto;min-height:32px;padding:2px 6px" value={erroInfo?.tipo ?? ''} onChange={(e) => {
                      const tipo = (e.target as HTMLSelectElement).value;
                      if (erroInfo) void mudarTipo(tipo);
                      else if (resp!.erro_id) { setErroInfo({ id: resp!.erro_id, tipo }); void (async () => { const r = await obter<Erro>('erros', resp!.erro_id!); if (r) await salvar('erros', resp!.erro_id!, { ...r.fm, tipo_de_erro: tipo }, r.secoes); })(); }
                    }}>
                      {!erroInfo && <option value="">escolher…</option>}
                      {TIPOS_ERRO.map(([t, n]) => <option value={t}>{n}</option>)}
                    </select>
                    <a class="pequeno" href={`/erros`} style="color:inherit">abrir caderno</a>
                  </div>
                )}
              </div>
            )}
            <div class="linha">
              {q.leiLink && <a class="btn pequeno" href={q.leiLink}>Ver na lei seca</a>}
              <button class="btn pequeno" type="button" onClick={() => { setRefazer(true); setMarcada(''); }}>Refazer</button>
            </div>
          </div>
        )}
      </article>

      <div class="linha entre nav-questoes">
        <button class="btn" type="button" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Anterior</button>
        <span class="sutil pequeno">{idx + 1} de {lista.length}</span>
        <button class="btn" type="button" disabled={idx >= lista.length - 1} onClick={() => setIdx(idx + 1)}>Próxima →</button>
      </div>
    </div>
  );
}
