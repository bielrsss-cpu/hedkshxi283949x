import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Semana, Tarefa } from '../lib/conteudo';
import { salvar } from '../lib/dados';
import { useColecao } from '../lib/hooks';
import { hoje, semanaDe } from '../lib/datas';
import { ETIQUETAS } from '../lib/disciplinas';

interface Props { semanas: Semana[]; prazos: Tarefa[] }
interface EstadoTarefa { feita: boolean; em: string }

export default function Cronograma({ semanas, prazos }: Props) {
  const registros = useColecao<EstadoTarefa>('tarefas');
  const feitas = useMemo(() => new Set((registros ?? []).filter((r) => r.fm.feita).map((r) => r.id)), [registros]);
  const atual = semanaDe(hoje(), semanas)?.id ?? (hoje() < semanas[0].inicio ? semanas[0].id : semanas[semanas.length - 1].id);
  const [abertas, setAbertas] = useState<Set<string>>(() => new Set([atual]));
  const [soPendentes, setSoPendentes] = useState(false);

  useEffect(() => {
    const el = document.getElementById(location.hash.slice(1) || `semana-${atual}`);
    if (location.hash && el?.tagName === 'DETAILS') setAbertas((a) => new Set([...a, location.hash.slice(8)]));
    setTimeout(() => el?.scrollIntoView({ block: 'start' }), 50);
  }, []);

  const total = semanas.reduce((n, s) => n + s.tarefas.length, 0);
  const feitasTotal = semanas.reduce((n, s) => n + s.tarefas.filter((t) => feitas.has(t.id)).length, 0);

  const alternar = (t: Tarefa) => {
    const nova = !feitas.has(t.id);
    void salvar('tarefas', t.id, { feita: nova, em: nova ? hoje() : '' });
  };

  const linhaTarefa = (t: Tarefa) => {
    const feita = feitas.has(t.id);
    if (soPendentes && feita) return null;
    return (
      <li class={`tarefa ${feita ? 'feita' : ''}`} key={t.id}>
        <label class="tarefa-check">
          <input type="checkbox" checked={feita} onChange={() => alternar(t)} aria-label={`Marcar ${t.id}`} />
        </label>
        <div class="tarefa-corpo">
          <div>
            <span class={`selo etq-${t.etiqueta.replace('/', '-')}`} title={ETIQUETAS[t.etiqueta]}>{t.etiqueta}</span>{' '}
            <span class="tarefa-texto">{t.texto}</span>
          </div>
          <div class="linha tarefa-acoes">
            <span class="sutil pequeno">{t.id}</span>
            {t.link && <a class="pequeno" href={t.link}>lei seca</a>}
            {t.etiqueta !== 'PRAZO' && <a class="btn pequeno" href={`/sessao?tarefa=${t.id}`}>Iniciar sessão</a>}
          </div>
        </div>
      </li>
    );
  };

  return (
    <div>
      <div class="cartao">
        <div class="linha entre">
          <strong>{feitasTotal} de {total} tarefas feitas</strong>
          <span class="sutil pequeno">{Math.round((feitasTotal / total) * 100)}%</span>
        </div>
        <div class="barra" style="margin: 8px 0"><span style={{ width: `${(feitasTotal / total) * 100}%` }} /></div>
        <div class="linha entre">
          <label class="linha" style="margin:0;color:var(--texto)">
            <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes((e.target as HTMLInputElement).checked)} /> Mostrar só pendentes
          </label>
          <a class="btn pequeno" href={`#semana-${atual}`} onClick={() => setAbertas((a) => new Set([...a, atual]))}>Ir para a semana atual</a>
        </div>
      </div>

      <details class="cartao semana">
        <summary><strong>Prazos do edital</strong> <span class="sutil pequeno">{prazos.filter((t) => feitas.has(t.id)).length}/{prazos.length}</span></summary>
        <ul class="lista-limpa">{prazos.map(linhaTarefa)}</ul>
      </details>

      {semanas.map((s) => {
        const n = s.tarefas.filter((t) => feitas.has(t.id)).length;
        const eAtual = s.id === atual;
        const passada = s.fim < hoje();
        return (
          <details
            key={s.id}
            id={`semana-${s.id}`}
            class={`cartao semana ${eAtual ? 'atual' : ''}`}
            open={abertas.has(s.id)}
            onToggle={(e) => {
              const aberto = (e.target as HTMLDetailsElement).open;
              setAbertas((a) => { const b = new Set(a); aberto ? b.add(s.id) : b.delete(s.id); return b; });
            }}
          >
            <summary>
              <span class="linha entre" style="display:inline-flex;width:calc(100% - 24px)">
                <span>
                  <strong>{s.id}</strong> <span class="sutil pequeno">{s.titulo.split(' · ').slice(1).join(' · ')}</span>
                </span>
                <span class="linha">
                  {eAtual && <span class="selo info">semana atual</span>}
                  <span class={`selo ${n === s.tarefas.length ? 'ok' : passada && n < s.tarefas.length ? 'pendente' : ''}`}>{n}/{s.tarefas.length}</span>
                </span>
              </span>
            </summary>
            <ul class="lista-limpa">{s.tarefas.map(linhaTarefa)}</ul>
          </details>
        );
      })}
    </div>
  );
}
