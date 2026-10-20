import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Semana, Tarefa } from '../lib/conteudo';
import { apagar, obter, salvar } from '../lib/dados';
import { useColecao, useParametros } from '../lib/hooks';
import { dataBR, hoje, horaAgora, semanaDe, somarDias } from '../lib/datas';
import { DISCIPLINAS, NOME_DISCIPLINA, TIPOS_SESSAO } from '../lib/disciplinas';
import { SECOES, type Sessao as TSessao } from '../lib/modelos';
import { toast } from '../lib/app';
import { CONFIG } from '../lib/config';
import Pomodoro from './Pomodoro';

interface Props { semanas: Semana[] }

const SEC = SECOES.sessoes;

function leiDoLink(link?: string): string[] {
  const m = link?.match(/\/lei-seca\/([\w-]+)(#[\w-]+)?/);
  return m ? [`03-lei-seca/${m[1]}.md${m[2] ?? ''}`] : [];
}

export const revisoesDe = (data: string) => [somarDias(data, 1), somarDias(data, 7), somarDias(data, 30)];

function vazio(semanas: Semana[]): TSessao {
  const d = hoje();
  return {
    data: d,
    inicio: horaAgora(),
    duracao_min: 0,
    semana: semanaDe(d, semanas)?.id ?? '',
    tipo: 'teoria',
    disciplina: '',
    topico: '',
    lei_seca: [],
    questoes: { feitas: 0, acertos: 0, fonte: '' },
    tarefa_cronograma: '',
    concluida: true,
    revisar_em: revisoesDe(d),
  };
}

export default function Sessao({ semanas }: Props) {
  const params = useParametros();
  const tarefas = useMemo(() => new Map<string, Tarefa>(semanas.flatMap((s) => s.tarefas.map((t) => [t.id, t] as [string, Tarefa]))), [semanas]);
  const [fm, setFm] = useState<TSessao>(() => vazio(semanas));
  const [secoes, setSecoes] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<string | null>(null);
  const [tarefaId, setTarefaId] = useState<string>('');
  const [marcarTarefa, setMarcarTarefa] = useState(true);
  const [zerar, setZerar] = useState(0);
  const [salvo, setSalvo] = useState<string | null>(null);
  const duracaoManual = useRef(false);
  const inicioManual = useRef(false);
  const sessoes = useColecao<TSessao>('sessoes');

  // Preenche a partir da URL: ?tarefa=S03-2  ou  ?id=...  ou  ?disciplina=&tipo=&topico=&lei=
  useEffect(() => {
    const id = params.get('id');
    if (id) {
      void obter<TSessao>('sessoes', id).then((r) => {
        if (!r) return;
        setFm({ ...vazio(semanas), ...r.fm });
        setSecoes(r.secoes ?? {});
        setEditando(id);
        duracaoManual.current = true;
        inicioManual.current = true;
      });
      return;
    }
    const t = tarefas.get(params.get('tarefa') ?? '');
    const base = vazio(semanas);
    if (t) {
      setTarefaId(t.id);
      setFm({
        ...base,
        semana: t.semana,
        tipo: t.tipo,
        disciplina: t.disciplina,
        topico: t.texto,
        lei_seca: leiDoLink(t.link),
        tarefa_cronograma: `${t.semana} · ${t.etiqueta} · ${t.texto}`,
      });
      return;
    }
    if (params.get('disciplina') || params.get('topico')) {
      setFm({
        ...base,
        disciplina: params.get('disciplina') ?? '',
        tipo: params.get('tipo') ?? base.tipo,
        topico: params.get('topico') ?? '',
        lei_seca: params.get('lei') ? [params.get('lei')!] : [],
      });
    }
  }, []);

  const set = <K extends keyof TSessao>(k: K, v: TSessao[K]) => setFm((f) => ({ ...f, [k]: v }));
  const setData = (d: string) =>
    setFm((f) => ({ ...f, data: d, semana: semanaDe(d, semanas)?.id ?? f.semana, revisar_em: revisoesDe(d) }));

  const onTempo = (min: number, inicio: string | null) => {
    if (editando) return;
    setFm((f) => ({
      ...f,
      duracao_min: duracaoManual.current ? f.duracao_min : min,
      inicio: !inicioManual.current && inicio ? inicio : f.inicio,
    }));
  };

  const salvarSessao = async (ev: Event) => {
    ev.preventDefault();
    if (!fm.disciplina) { toast('Escolha a disciplina'); return; }
    let id = editando ?? `${fm.data}-${fm.inicio.replace(':', '')}-${fm.disciplina}`;
    if (!editando && (await obter('sessoes', id))) id += `-${Date.now().toString(36).slice(-4)}`;
    const limpo: TSessao = {
      ...fm,
      duracao_min: Number(fm.duracao_min) || 0,
      questoes: { feitas: Number(fm.questoes.feitas) || 0, acertos: Number(fm.questoes.acertos) || 0, fonte: fm.questoes.fonte },
      lei_seca: fm.lei_seca.filter(Boolean),
    };
    await salvar('sessoes', id, limpo, secoes);
    if (tarefaId && marcarTarefa) await salvar('tarefas', tarefaId, { feita: true, em: fm.data });
    toast(editando ? 'Sessão atualizada' : 'Sessão salva');
    setSalvo(id);
    if (!editando) {
      setZerar(Date.now());
      duracaoManual.current = false;
      inicioManual.current = false;
    }
  };

  const novaSessao = () => {
    setFm(vazio(semanas));
    setSecoes({});
    setEditando(null);
    setTarefaId('');
    setSalvo(null);
    history.replaceState(null, '', '/sessao');
  };

  const linkErro = salvo
    ? `/erros?novo=1&disciplina=${encodeURIComponent(fm.disciplina)}&assunto=${encodeURIComponent(fm.topico)}&lei=${encodeURIComponent(fm.lei_seca[0] ?? '')}&origem=${encodeURIComponent(fm.questoes.fonte)}`
    : '';

  const recentes = (sessoes ?? []).slice().sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, 30);

  return (
    <div>
      {!editando && <Pomodoro onTempo={onTempo} zerar={zerar} />}

      {salvo && (
        <div class="aviso ok">
          Sessão salva. Revisões em {fm.revisar_em.map(dataBR).join(', ')}.
          <div class="linha" style="margin-top:8px">
            <a class="btn pequeno" href={linkErro}>Registrar um erro desta sessão</a>
            <button class="btn pequeno" type="button" onClick={novaSessao}>Nova sessão</button>
          </div>
        </div>
      )}

      <form class="cartao" onSubmit={salvarSessao}>
        <h2>{editando ? 'Editar sessão' : 'Registro da sessão'}</h2>
        {fm.tarefa_cronograma && <p class="pequeno"><span class="selo info">Tarefa</span> {fm.tarefa_cronograma}</p>}
        <div class="campos">
          <div class="campo"><label>Data</label><input type="date" value={fm.data} onChange={(e) => setData((e.target as HTMLInputElement).value)} required /></div>
          <div class="campo"><label>Início</label><input type="time" value={fm.inicio} onChange={(e) => { inicioManual.current = true; set('inicio', (e.target as HTMLInputElement).value); }} required /></div>
          <div class="campo"><label>Duração (min)</label><input type="number" min={0} value={fm.duracao_min} onInput={(e) => { duracaoManual.current = true; set('duracao_min', Number((e.target as HTMLInputElement).value)); }} /></div>
          <div class="campo"><label>Semana</label>
            <select value={fm.semana} onChange={(e) => set('semana', (e.target as HTMLSelectElement).value)}>
              <option value="">—</option>
              {semanas.map((s) => <option value={s.id}>{s.id}</option>)}
            </select>
          </div>
        </div>
        <div class="campos">
          <div class="campo"><label>Disciplina</label>
            <select value={fm.disciplina} onChange={(e) => set('disciplina', (e.target as HTMLSelectElement).value)} required>
              <option value="">Escolha…</option>
              {DISCIPLINAS.map(([v, n]) => <option value={v}>{n}</option>)}
            </select>
          </div>
          <div class="campo"><label>Tipo</label>
            <select value={fm.tipo} onChange={(e) => set('tipo', (e.target as HTMLSelectElement).value)}>
              {TIPOS_SESSAO.map((t) => <option value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div class="campo"><label>Tópico</label><input value={fm.topico} onInput={(e) => set('topico', (e.target as HTMLInputElement).value)} placeholder="CF art. 5º, incisos I a XXXV" /></div>
        <div class="campo"><label>Lei seca (um por linha)</label>
          <textarea rows={2} value={fm.lei_seca.join('\n')} onInput={(e) => set('lei_seca', (e.target as HTMLTextAreaElement).value.split('\n'))} placeholder="03-lei-seca/01-constitucional-cf.md#art-5" />
          {fm.lei_seca.filter(Boolean).map((l) => {
            const m = l.match(/03-lei-seca\/([\w-]+)\.md(#[\w-]+)?/);
            return m ? <a class="pequeno" style="margin-right:8px" href={`/lei-seca/${m[1]}${m[2] ?? ''}`}>abrir {m[2]?.slice(1) ?? m[1]}</a> : null;
          })}
        </div>
        <div class="campos">
          <div class="campo"><label>Questões feitas</label><input type="number" min={0} value={fm.questoes.feitas} onInput={(e) => set('questoes', { ...fm.questoes, feitas: Number((e.target as HTMLInputElement).value) })} /></div>
          <div class="campo"><label>Acertos</label><input type="number" min={0} value={fm.questoes.acertos} onInput={(e) => set('questoes', { ...fm.questoes, acertos: Number((e.target as HTMLInputElement).value) })} /></div>
          <div class="campo" style="grid-column: span 2"><label>Fonte das questões</label><input value={fm.questoes.fonte} onInput={(e) => set('questoes', { ...fm.questoes, fonte: (e.target as HTMLInputElement).value })} placeholder={`QConcursos, filtro ${CONFIG.banca}`} /></div>
        </div>
        {SEC.map((t) => (
          <div class="campo" key={t}>
            <label>{t}</label>
            <textarea rows={t === 'O que estudei' ? 3 : 2} value={secoes[t] ?? ''} onInput={(e) => setSecoes((s) => ({ ...s, [t]: (e.target as HTMLTextAreaElement).value }))} />
          </div>
        ))}
        <div class="linha" style="margin-bottom:12px">
          <label class="linha" style="margin:0;color:var(--texto)"><input type="checkbox" checked={fm.concluida} onChange={(e) => set('concluida', (e.target as HTMLInputElement).checked)} /> Sessão concluída</label>
          {tarefaId && (
            <label class="linha" style="margin:0;color:var(--texto)"><input type="checkbox" checked={marcarTarefa} onChange={(e) => setMarcarTarefa((e.target as HTMLInputElement).checked)} /> Marcar {tarefaId} como feita no cronograma</label>
          )}
        </div>
        <p class="sutil pequeno">Revisões automáticas: {fm.revisar_em.map(dataBR).join(' · ')} (+1, +7 e +30 dias)</p>
        <div class="linha">
          <button class="btn primario" type="submit">{editando ? 'Salvar alterações' : 'Salvar sessão'}</button>
          {editando && <button class="btn" type="button" onClick={novaSessao}>Cancelar edição</button>}
        </div>
      </form>

      <h2>Sessões registradas</h2>
      {sessoes === null ? <p class="vazio">Carregando…</p> : recentes.length === 0 ? <p class="vazio">Nenhuma sessão ainda.</p> : (
        <ul class="lista-limpa">
          {recentes.map((s) => (
            <li class="cartao" key={s.id}>
              <div class="linha entre">
                <strong>{dataBR(s.fm.data)} {s.fm.inicio}</strong>
                <span class="selo info">{NOME_DISCIPLINA[s.fm.disciplina] ?? s.fm.disciplina}</span>
              </div>
              <div>{s.fm.topico}</div>
              <div class="sutil pequeno">
                {s.fm.duracao_min} min · {s.fm.tipo}
                {s.fm.questoes?.feitas ? ` · ${s.fm.questoes.acertos}/${s.fm.questoes.feitas} questões` : ''}
              </div>
              <div class="linha" style="margin-top:6px">
                <a class="btn pequeno" href={`/sessao?id=${s.id}`}>Editar</a>
                <button class="btn pequeno perigo" type="button" onClick={() => { if (confirm('Apagar esta sessão?')) void apagar('sessoes', s.id); }}>Apagar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
