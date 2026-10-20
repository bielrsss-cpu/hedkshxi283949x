import { useMemo, useState } from 'preact/hooks';
import { apagar, salvar } from '../lib/dados';
import { useColecao } from '../lib/hooks';
import { dataBR, hoje } from '../lib/datas';
import { SECOES, SIMULADO_DISCIPLINAS, type Simulado as TSim } from '../lib/modelos';
import { CONFIG, blocoDaDisciplina } from '../lib/config';
import { toast } from '../lib/app';

const [S_TABELA, S_TEMPO, S_ERROS] = SECOES.simulados;
const OBJ = CONFIG.objetiva;
const BLOCOS = OBJ.blocos;

export function nota(acertos: number) {
  return Math.round((acertos / OBJ.total) * OBJ.nota_max * 10) / 10;
}

export function resultadoVazio(): TSim['resultado'] {
  const r: Record<string, any> = {};
  for (const b of BLOCOS) r[b.id] = b.minimo != null ? { acertos: 0, total: b.total, minimo: b.minimo } : { acertos: 0, total: b.total };
  r.total = { acertos: 0, total: OBJ.total, meta: OBJ.meta };
  r.nota_0_a_10 = 0;
  return r as TSim['resultado'];
}

function vazio(numero: number): TSim {
  return {
    numero, data: hoje(), prova: '', tempo_total_min: CONFIG.prova.duracao_min,
    resultado: resultadoVazio(),
    redacao_nota_estimada: null,
  };
}

function tabela(por: Record<string, number | ''>): string {
  return ['| Disciplina | Acertos | Total |', '|---|---|---|', ...SIMULADO_DISCIPLINAS.map(([k, n, t]) => `| ${n} | ${por[k] ?? ''} | ${t} |`)].join('\n');
}
function lerTabela(md = ''): Record<string, number | ''> {
  const out: Record<string, number | ''> = {};
  for (const [k, n] of SIMULADO_DISCIPLINAS) {
    const m = md.match(new RegExp(`\\|\\s*${n.replace(/[/.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\|\\s*(\\d*)\\s*\\|`));
    out[k] = m && m[1] !== '' ? Number(m[1]) : '';
  }
  return out;
}

export function alertas(r: TSim['resultado']): { tipo: 'perigo' | 'alerta' | 'ok'; texto: string }[] {
  const a: { tipo: 'perigo' | 'alerta' | 'ok'; texto: string }[] = [];
  for (const b of BLOCOS) {
    const ac = r[b.id]?.acertos ?? 0;
    if (b.minimo != null && ac < b.minimo) a.push({ tipo: 'perigo', texto: `${b.nome} abaixo do mínimo: ${ac}/${b.total} (mínimo ${b.minimo}). Eliminaria.` });
  }
  if (r.total.acertos < OBJ.meta) a.push({ tipo: 'alerta', texto: `Abaixo da meta: ${r.total.acertos}/${OBJ.total} (meta ${OBJ.meta}). Faltam ${OBJ.meta - r.total.acertos}.` });
  if (!a.length) a.push({ tipo: 'ok', texto: `Meta batida: ${r.total.acertos}/${OBJ.total}.` });
  return a;
}

export default function Simulados() {
  const itens = useColecao<TSim>('simulados');
  const [form, setForm] = useState<{ id?: string; fm: TSim; por: Record<string, number | ''>; tempo: string; erros: string } | null>(null);
  const proximo = useMemo(() => Math.max(0, ...(itens ?? []).map((r) => Number(r.fm.numero) || 0)) + 1, [itens]);

  const recalcular = (fm: TSim, por: Record<string, number | ''>): TSim => {
    const usarDisc = Object.values(por).some((v) => v !== '');
    const r = structuredClone({ ...resultadoVazio(), ...fm.resultado });
    if (usarDisc) {
      for (const b of BLOCOS) r[b.id].acertos = 0;
      for (const [k] of SIMULADO_DISCIPLINAS) {
        const b = blocoDaDisciplina(k);
        if (b) r[b.id].acertos += Number(por[k]) || 0;
      }
    }
    r.total.acertos = BLOCOS.reduce((s, b) => s + (r[b.id]?.acertos ?? 0), 0);
    r.nota_0_a_10 = nota(r.total.acertos);
    return { ...fm, resultado: r };
  };

  if (form) {
    const { fm, por } = form;
    const r = fm.resultado;
    const usarDisc = Object.values(por).some((v) => v !== '');
    const val = (e: Event) => (e.target as HTMLInputElement).value;
    const setFm = (novo: TSim) => setForm({ ...form, fm: recalcular(novo, por) });
    const setBloco = (id: string, v: number) =>
      setFm({ ...fm, resultado: { ...r, [id]: { ...r[id], acertos: Math.min(v, r[id].total) } } });
    const setDisc = (k: string, v: string) => {
      const p: Record<string, number | ''> = { ...por, [k]: v === '' ? '' : Number(v) };
      setForm({ ...form, por: p, fm: recalcular(fm, p) });
    };
    const enviar = async (e: Event) => {
      e.preventDefault();
      const id = form.id ?? `${fm.data}-simulado-${String(fm.numero).padStart(2, '0')}`;
      await salvar('simulados', id, fm, { [S_TABELA]: tabela(por), [S_TEMPO]: form.tempo, [S_ERROS]: form.erros });
      toast('Simulado salvo');
      setForm(null);
    };
    return (
      <form class="cartao" onSubmit={enviar}>
        <h2>{form.id ? `Simulado nº ${fm.numero}` : 'Novo simulado'}</h2>
        <div class="campos">
          <div class="campo"><label>Número</label><input type="number" min={1} value={fm.numero} onInput={(e) => setFm({ ...fm, numero: Number(val(e)) })} /></div>
          <div class="campo"><label>Data</label><input type="date" value={fm.data} onChange={(e) => setFm({ ...fm, data: val(e) })} /></div>
          <div class="campo"><label>Tempo total (min)</label><input type="number" value={fm.tempo_total_min} onInput={(e) => setFm({ ...fm, tempo_total_min: Number(val(e)) })} /></div>
        </div>
        <div class="campo"><label>Prova</label><input value={fm.prova} onInput={(e) => setFm({ ...fm, prova: val(e) })} placeholder={`${CONFIG.banca} 2025 · ${CONFIG.orgao} · ${CONFIG.cargo}`} /></div>

        <h3>Acertos por disciplina <span class="sutil pequeno">(opcional: preenche os blocos)</span></h3>
        <div class="campos">
          {SIMULADO_DISCIPLINAS.map(([k, n, t]) => (
            <div class="campo" key={k}><label>{n} (/{t})</label><input type="number" min={0} max={t} value={por[k]} onInput={(e) => setDisc(k, val(e))} /></div>
          ))}
        </div>

        <h3>Blocos</h3>
        <div class="campos">
          {BLOCOS.map((b) => (
            <div class="campo" key={b.id}>
              <label>{b.nome} (/{b.total}{b.minimo != null ? `, mín. ${b.minimo}` : ''})</label>
              <input type="number" min={0} max={b.total} value={r[b.id]?.acertos ?? 0} disabled={usarDisc} onInput={(e) => setBloco(b.id, Number(val(e)))} />
            </div>
          ))}
          {CONFIG.redacao.existe && (
            <div class="campo"><label>Redação (nota estimada, 0–{CONFIG.redacao.nota_max})</label><input type="number" min={0} max={CONFIG.redacao.nota_max} value={fm.redacao_nota_estimada ?? ''} onInput={(e) => setFm({ ...fm, redacao_nota_estimada: val(e) === '' ? null : Number(val(e)) })} /></div>
          )}
        </div>
        <p><strong>Total: {r.total.acertos}/{OBJ.total}</strong> · nota {r.nota_0_a_10.toFixed(1)}</p>
        {alertas(r).map((a) => <p class={`aviso ${a.tipo === 'alerta' ? '' : a.tipo}`}>{a.texto}</p>)}

        <div class="campo"><label>{S_TEMPO}</label><textarea rows={3} value={form.tempo} onInput={(e) => setForm({ ...form, tempo: val(e) })} /></div>
        <div class="campo"><label>{S_ERROS}</label><textarea rows={3} value={form.erros} onInput={(e) => setForm({ ...form, erros: val(e) })} /></div>
        <div class="linha">
          <button class="btn primario" type="submit">Salvar</button>
          <button class="btn" type="button" onClick={() => setForm(null)}>Cancelar</button>
        </div>
      </form>
    );
  }

  const lista = (itens ?? []).slice().sort((a, b) => (a.fm.data < b.fm.data ? 1 : -1));
  return (
    <div>
      <button class="btn primario" style="margin-bottom:12px" onClick={() => setForm({ fm: vazio(proximo), por: lerTabela(), tempo: '', erros: '' })}>Novo simulado</button>
      {itens === null ? <p class="vazio">Carregando…</p> : lista.length === 0 ? <p class="vazio">Nenhum simulado registrado.</p> : (
        <ul class="lista-limpa">
          {lista.map((s) => {
            const r = s.fm.resultado;
            return (
              <li class="cartao" key={s.id}>
                <div class="linha entre">
                  <strong>Nº {s.fm.numero} · {dataBR(s.fm.data)}</strong>
                  <span class={`selo ${r.total.acertos >= OBJ.meta ? 'ok' : 'pendente'}`}>{r.total.acertos}/{OBJ.total} · {r.nota_0_a_10.toFixed(1)}</span>
                </div>
                <div class="sutil pequeno">{s.fm.prova}</div>
                <div class="pequeno" style="margin-top:4px">
                  {BLOCOS.map((b) => `${b.nome} ${r[b.id]?.acertos ?? 0}/${b.total}`).join(' · ')}
                  {s.fm.redacao_nota_estimada != null ? ` · Redação ${s.fm.redacao_nota_estimada}/${CONFIG.redacao.nota_max}` : ''}
                </div>
                {alertas(r).filter((a) => a.tipo !== 'ok').map((a) => <p class={`aviso ${a.tipo === 'alerta' ? '' : a.tipo}`} style="margin:6px 0 0">{a.texto}</p>)}
                <div class="linha" style="margin-top:6px">
                  <button class="btn pequeno" onClick={() => setForm({ id: s.id, fm: { ...vazio(s.fm.numero), ...s.fm }, por: lerTabela(s.secoes?.[S_TABELA]), tempo: s.secoes?.[S_TEMPO] ?? '', erros: s.secoes?.[S_ERROS] ?? '' })}>Abrir</button>
                  <button class="btn pequeno perigo" onClick={() => { if (confirm('Apagar este simulado?')) void apagar('simulados', s.id); }}>Apagar</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
