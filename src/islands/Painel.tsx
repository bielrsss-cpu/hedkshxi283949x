import { useMemo } from 'preact/hooks';
import type { Semana } from '../lib/conteudo';
import { salvar } from '../lib/dados';
import { useColecao } from '../lib/hooks';
import { dataBR, diasEntre, hoje, semanaDe } from '../lib/datas';
import { DATA_PROVA, DISCIPLINAS, NOME_DISCIPLINA } from '../lib/disciplinas';
import { CONFIG } from '../lib/config';
import type { Erro, Sessao, Simulado } from '../lib/modelos';
import { alertas } from './Simulados';

interface Props { semanas: Semana[] }

const META_SEMANA_MIN = CONFIG.estudo.minutos_por_dia * 7;

function Barra({ v, max }: { v: number; max: number }) {
  return <div class="barra"><span style={{ width: `${max ? Math.min(100, (v / max) * 100) : 0}%` }} /></div>;
}

export default function Painel({ semanas }: Props) {
  const sessoes = useColecao<Sessao>('sessoes');
  const tarefas = useColecao<{ feita: boolean }>('tarefas');
  const erros = useColecao<Erro>('erros');
  const simulados = useColecao<Simulado>('simulados');
  const revisoes = useColecao<{ sessao: string; data: string }>('revisoes');
  const respostas = useColecao<{ disciplina: string; acertou: boolean }>('respostas');

  const d = hoje();
  const faltam = diasEntre(d, DATA_PROVA);
  const semana = semanaDe(d, semanas) ?? (d < semanas[0].inicio ? semanas[0] : undefined);
  const feitas = useMemo(() => new Set((tarefas ?? []).filter((t) => t.fm.feita).map((t) => t.id)), [tarefas]);

  const todas = semanas.flatMap((s) => s.tarefas);
  const porDisc = DISCIPLINAS.map(([k, n]) => {
    const ts = todas.filter((t) => t.disciplina === k);
    return { k, n, total: ts.length, feitas: ts.filter((t) => feitas.has(t.id)).length };
  }).filter((x) => x.total > 0);

  const minutosSemana = (sessoes ?? [])
    .filter((s) => semana && s.fm.data >= semana.inicio && s.fm.data <= semana.fim)
    .reduce((n, s) => n + (Number(s.fm.duracao_min) || 0), 0);
  const minutosHoje = (sessoes ?? []).filter((s) => s.fm.data === d).reduce((n, s) => n + (Number(s.fm.duracao_min) || 0), 0);

  const acertos = DISCIPLINAS.map(([k, n]) => {
    const ss = (sessoes ?? []).filter((s) => s.fm.disciplina === k);
    const rs = (respostas ?? []).filter((r) => r.fm.disciplina === k);
    const feitasQ = ss.reduce((a, s) => a + (Number(s.fm.questoes?.feitas) || 0), 0) + rs.length;
    const certas = ss.reduce((a, s) => a + (Number(s.fm.questoes?.acertos) || 0), 0) + rs.filter((r) => r.fm.acertou).length;
    return { k, n, feitas: feitasQ, certas };
  }).filter((x) => x.feitas > 0);

  const feitasRev = new Set((revisoes ?? []).map((r) => r.id));
  const vencidas = (sessoes ?? [])
    .flatMap((s) => (s.fm.revisar_em ?? []).map((data, i) => ({ s, data: String(data), n: i, id: `${s.id}__${data}` })))
    .filter((r) => r.data <= d && !feitasRev.has(r.id))
    .sort((a, b) => (a.data < b.data ? -1 : 1));

  const errosPendentes = (erros ?? []).filter((e) => !e.fm.dominado).length;
  const ultimoSim = (simulados ?? []).slice().sort((a, b) => (a.fm.data < b.fm.data ? 1 : -1))[0];

  const h = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
  const rotRev = ['+1 dia', '+7 dias', '+30 dias'];

  return (
    <div>
      <div class="grade" style="margin-bottom:12px">
        <div class="cartao"><div class="rotulo">Faltam para a prova</div><div class="numero">{faltam} dias</div><div class="sutil pequeno">{CONFIG.prova.descricao || dataBR(DATA_PROVA)}</div></div>
        <div class="cartao"><div class="rotulo">Estudado na semana</div><div class="numero">{h(minutosSemana)}</div><Barra v={minutosSemana} max={META_SEMANA_MIN} /><div class="sutil pequeno">meta {h(META_SEMANA_MIN)} · hoje {h(minutosHoje)}</div></div>
        <div class="cartao"><div class="rotulo">Cronograma</div><div class="numero">{Math.round((feitas.size / Math.max(1, todas.length)) * 100)}%</div><Barra v={todas.filter((t) => feitas.has(t.id)).length} max={todas.length} /><div class="sutil pequeno">{todas.filter((t) => feitas.has(t.id)).length} de {todas.length} tarefas</div></div>
        <div class="cartao"><div class="rotulo">Erros pendentes</div><div class="numero">{errosPendentes}</div><a class="pequeno" href="/erros">abrir caderno</a></div>
      </div>

      <div class="grade-2">
        <div class="cartao">
          <h2>Revisões para hoje {vencidas.length > 0 && <span class="selo pendente">{vencidas.length}</span>}</h2>
          {sessoes === null ? <p class="sutil">Carregando…</p> : vencidas.length === 0 ? <p class="sutil">Nenhuma revisão vencendo hoje.</p> : (
            <ul class="lista-limpa">
              {vencidas.slice(0, 12).map((r) => {
                const lei = r.s.fm.lei_seca?.[0];
                return (
                  <li key={r.id} style="padding:8px 0;border-top:1px solid var(--borda)">
                    <div class="linha entre">
                      <span class="selo info">{NOME_DISCIPLINA[r.s.fm.disciplina] ?? r.s.fm.disciplina}</span>
                      <span class={`pequeno ${r.data < d ? 'sutil' : ''}`}>{rotRev[r.n] ?? ''}{r.data < d ? ` · atrasada desde ${dataBR(r.data)}` : ''}</span>
                    </div>
                    <div>{r.s.fm.topico}</div>
                    <div class="linha" style="margin-top:4px">
                      <a class="btn pequeno" href={`/sessao?tipo=revisao&disciplina=${encodeURIComponent(r.s.fm.disciplina)}&topico=${encodeURIComponent('Revisão: ' + r.s.fm.topico)}${lei ? `&lei=${encodeURIComponent(lei)}` : ''}`}>Revisar agora</a>
                      <button class="btn pequeno" onClick={() => void salvar('revisoes', r.id, { sessao: r.s.id, data: r.data, feita_em: d })}>Marcar feita</button>
                    </div>
                  </li>
                );
              })}
              {vencidas.length > 12 && <li class="sutil pequeno">+{vencidas.length - 12} revisões</li>}
            </ul>
          )}
        </div>

        <div class="cartao">
          {semana ? (
            <>
              <h2>Semana {semana.id} <span class="sutil pequeno">{dataBR(semana.inicio)} – {dataBR(semana.fim)}</span></h2>
              <ul class="lista-limpa">
                {semana.tarefas.map((t) => (
                  <li key={t.id} class="linha" style="padding:6px 0;border-top:1px solid var(--borda);flex-wrap:nowrap;align-items:flex-start">
                    <input type="checkbox" style="width:20px;height:20px;margin-top:2px" checked={feitas.has(t.id)} onChange={() => void salvar('tarefas', t.id, { feita: !feitas.has(t.id), em: feitas.has(t.id) ? '' : d })} aria-label={`Marcar ${t.id}`} />
                    <span style={{ flex: 1, textDecoration: feitas.has(t.id) ? 'line-through' : 'none', color: feitas.has(t.id) ? 'var(--texto-2)' : undefined }}>
                      <span class="selo">{t.etiqueta}</span> {t.texto}
                    </span>
                    {!feitas.has(t.id) && t.etiqueta !== 'PRAZO' && <a class="btn pequeno" href={`/sessao?tarefa=${t.id}`} aria-label={`Iniciar sessão ${t.id}`}>▶</a>}
                  </li>
                ))}
              </ul>
              <a class="pequeno" href={`/cronograma#semana-${semana.id}`}>ver no cronograma</a>
            </>
          ) : <p>Fora do período do cronograma.</p>}
        </div>

        <div class="cartao">
          <h2>Progresso por disciplina</h2>
          {porDisc.map((x) => (
            <div key={x.k} style="margin-bottom:8px">
              <div class="linha entre pequeno"><span>{x.n}</span><span class="sutil">{x.feitas}/{x.total}</span></div>
              <Barra v={x.feitas} max={x.total} />
            </div>
          ))}
        </div>

        <div class="cartao">
          <h2>Acertos por disciplina</h2>
          {acertos.length === 0 ? <p class="sutil">Registre questões nas sessões ou resolva provas em <a href="/questoes">Questões</a>.</p> : (
            <table>
              <thead><tr><th>Disciplina</th><th>Acertos</th><th>%</th></tr></thead>
              <tbody>
                {acertos.map((x) => {
                  const p = Math.round((x.certas / x.feitas) * 100);
                  return <tr key={x.k}><td>{x.n}</td><td>{x.certas}/{x.feitas}</td><td><span class={`selo ${p >= 75 ? 'ok' : p >= 50 ? 'pendente' : 'perigo'}`}>{p}%</span></td></tr>;
                })}
              </tbody>
            </table>
          )}
        </div>

        {ultimoSim && (
          <div class="cartao">
            <h2>Último simulado</h2>
            <p><strong>{ultimoSim.fm.resultado.total.acertos}/{CONFIG.objetiva.total}</strong> · nota {ultimoSim.fm.resultado.nota_0_a_10.toFixed(1)} · {dataBR(ultimoSim.fm.data)}</p>
            {alertas(ultimoSim.fm.resultado).map((a) => <p class={`aviso ${a.tipo === 'alerta' ? '' : a.tipo}`}>{a.texto}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
