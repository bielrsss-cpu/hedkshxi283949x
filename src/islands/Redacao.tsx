import { useMemo, useState } from 'preact/hooks';
import { apagar, salvar, type Registro } from '../lib/dados';
import { useColecao } from '../lib/hooks';
import { dataBR, hoje } from '../lib/datas';
import { SECOES, type Redacao as TRedacao } from '../lib/modelos';
import { toast } from '../lib/app';

import { CONFIG } from '../lib/config';

const MINIMO = CONFIG.redacao.minimo;
const MAX = CONFIG.redacao.nota_max;
const CRIT = CONFIG.redacao.criterios;
const SEC = SECOES.redacoes;

function Grafico({ itens }: { itens: Registro<TRedacao>[] }) {
  const pontos = itens.filter((r) => r.fm.nota_estimada?.total != null).sort((a, b) => (a.fm.data < b.fm.data ? -1 : 1));
  if (pontos.length < 1) return <p class="sutil pequeno">O gráfico aparece quando houver redações com nota.</p>;
  const L = 600, A = 220, m = { e: 34, d: 12, t: 12, b: 28 };
  const x = (i: number) => m.e + (pontos.length === 1 ? (L - m.e - m.d) / 2 : (i * (L - m.e - m.d)) / (pontos.length - 1));
  const y = (v: number) => m.t + (1 - v / MAX) * (A - m.t - m.b);
  const caminho = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.fm.nota_estimada.total!)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Evolução da nota das redações" style="width:100%;height:auto">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * MAX)).map((v) => (
        <g key={v}>
          <line x1={m.e} x2={L - m.d} y1={y(v)} y2={y(v)} stroke="var(--borda)" />
          <text x={m.e - 6} y={y(v) + 4} text-anchor="end" font-size="11" fill="var(--texto-2)">{v}</text>
        </g>
      ))}
      <line x1={m.e} x2={L - m.d} y1={y(MINIMO)} y2={y(MINIMO)} stroke="var(--perigo)" stroke-dasharray="5 4" />
      <text x={L - m.d} y={y(MINIMO) - 5} text-anchor="end" font-size="11" fill="var(--perigo)">mínimo {MINIMO}</text>
      <path d={caminho} fill="none" stroke="var(--primaria)" stroke-width="2.5" />
      {pontos.map((p, i) => (
        <g key={p.id}>
          <circle cx={x(i)} cy={y(p.fm.nota_estimada.total!)} r="4.5" fill={p.fm.nota_estimada.total! >= MINIMO ? 'var(--primaria)' : 'var(--perigo)'}>
            <title>{`Nº ${p.fm.numero} · ${dataBR(p.fm.data)} · ${p.fm.nota_estimada.total}`}</title>
          </circle>
          {pontos.length <= 12 && <text x={x(i)} y={A - 8} text-anchor="middle" font-size="11" fill="var(--texto-2)">{p.fm.numero}</text>}
        </g>
      ))}
    </svg>
  );
}

function vazio(numero: number): TRedacao {
  return {
    numero, data: hoje(), tema: '', tempo_min: 60, linhas: 0,
    nota_estimada: { ...Object.fromEntries(CRIT.map((c) => [c.id, null])), total: null },
    corrigida_por: '',
  };
}

export default function Redacao() {
  const itens = useColecao<TRedacao>('redacoes');
  const [form, setForm] = useState<{ id?: string; fm: TRedacao; secoes: Record<string, string> } | null>(null);
  const proximo = useMemo(() => Math.max(0, ...(itens ?? []).map((r) => Number(r.fm.numero) || 0)) + 1, [itens]);

  const n = (v: string) => (v === '' ? null : Number(v));
  const setNota = (k: string, v: number | null) =>
    setForm((f) => {
      if (!f) return f;
      const nota = { ...f.fm.nota_estimada, [k]: v };
      const partes = CRIT.map((c) => nota[c.id] ?? null);
      nota.total = partes.every((p) => p === null) ? null : partes.reduce<number>((s, p) => s + (p ?? 0), 0);
      return { ...f, fm: { ...f.fm, nota_estimada: nota } };
    });

  const enviar = async (e: Event) => {
    e.preventDefault();
    if (!form) return;
    const fm = form.fm;
    if ((fm.nota_estimada.total ?? 0) > MAX) { toast(`A nota total vai de 0 a ${MAX}`); return; }
    const id = form.id ?? `${fm.data}-redacao-${String(fm.numero).padStart(2, '0')}`;
    await salvar('redacoes', id, fm, form.secoes);
    toast('Redação salva');
    setForm(null);
  };

  if (form) {
    const fm = form.fm;
    const set = <K extends keyof TRedacao>(k: K, v: TRedacao[K]) => setForm({ ...form, fm: { ...fm, [k]: v } });
    const val = (e: Event) => (e.target as HTMLInputElement).value;
    return (
      <form class="cartao" onSubmit={enviar}>
        <h2>{form.id ? `Redação nº ${fm.numero}` : 'Nova redação'}</h2>
        <div class="campos">
          <div class="campo"><label>Número</label><input type="number" min={1} value={fm.numero} onInput={(e) => set('numero', Number(val(e)))} /></div>
          <div class="campo"><label>Data</label><input type="date" value={fm.data} onChange={(e) => set('data', val(e))} /></div>
          <div class="campo"><label>Tempo (min)</label><input type="number" min={0} value={fm.tempo_min} onInput={(e) => set('tempo_min', Number(val(e)))} /></div>
          <div class="campo"><label>Linhas</label><input type="number" min={0} max={80} value={fm.linhas} onInput={(e) => set('linhas', Number(val(e)))} /></div>
        </div>
        {fm.linhas > 0 && (() => { const a = CONFIG.redacao.avisos_linhas.find((x) => fm.linhas <= x.ate); return a ? <p class={`aviso ${a.tipo === 'perigo' ? 'perigo' : ''}`}>{a.texto}</p> : null; })()}
        {fm.linhas > 7 && fm.linhas <= 20 && <p class="aviso">Com 20 linhas ou menos, o texto não alcança a nota máxima em língua e coesão.</p>}
        <div class="campo"><label>Tema</label><input value={fm.tema} onInput={(e) => set('tema', val(e))} /></div>
        <fieldset class="campo" style="border:1px solid var(--borda);border-radius:8px">
          <legend class="pequeno">Nota estimada (edital: 0 a {MAX}, mínimo {MINIMO})</legend>
          <div class="campos">
            {CRIT.map((c) => (
              <div class="campo" key={c.id}><label title={c.dica}>{c.nome}</label><input type="number" min={0} max={MAX} step="0.5" value={fm.nota_estimada[c.id] ?? ''} onInput={(e) => setNota(c.id, n(val(e)))} /></div>
            ))}
            <div class="campo"><label>Total</label><input readOnly value={fm.nota_estimada.total ?? ''} /></div>
          </div>
          {fm.nota_estimada.total != null && (
            <p class={`aviso ${fm.nota_estimada.total >= MINIMO ? 'ok' : 'perigo'}`} style="margin:0 0 8px">
              {fm.nota_estimada.total >= MINIMO ? `Acima do mínimo de ${MINIMO}.` : `Abaixo do mínimo: faltam ${MINIMO - fm.nota_estimada.total} ponto(s).`}
            </p>
          )}
        </fieldset>
        <div class="campo"><label>Corrigida por</label><input value={fm.corrigida_por} onInput={(e) => set('corrigida_por', val(e))} placeholder="autocorreção, professor, colega…" /></div>
        {SEC.map((t) => (
          <div class="campo" key={t}>
            <label>{t}</label>
            <textarea rows={t === 'Texto' ? 14 : 3} value={form.secoes[t] ?? ''} onInput={(e) => setForm({ ...form, secoes: { ...form.secoes, [t]: (e.target as HTMLTextAreaElement).value } })} />
          </div>
        ))}
        <div class="linha">
          <button class="btn primario" type="submit">Salvar</button>
          <button class="btn" type="button" onClick={() => setForm(null)}>Cancelar</button>
        </div>
      </form>
    );
  }

  const lista = (itens ?? []).slice().sort((a, b) => (a.fm.data < b.fm.data ? 1 : -1));
  const notas = lista.map((r) => r.fm.nota_estimada?.total).filter((v): v is number => v != null);
  const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;

  return (
    <div>
      <button class="btn primario" style="margin-bottom:12px" onClick={() => setForm({ fm: vazio(proximo), secoes: {} })}>Nova redação</button>
      <div class="grade" style="margin-bottom:12px">
        <div class="cartao"><div class="rotulo">Redações</div><div class="numero">{lista.length}</div></div>
        <div class="cartao"><div class="rotulo">Última nota</div><div class="numero">{notas[0] ?? '—'}</div></div>
        <div class="cartao"><div class="rotulo">Média</div><div class="numero">{media != null ? media.toFixed(1) : '—'}</div></div>
      </div>
      <div class="cartao"><h3>Evolução</h3><Grafico itens={lista} /></div>
      {itens === null ? <p class="vazio">Carregando…</p> : lista.length === 0 ? <p class="vazio">Nenhuma redação registrada.</p> : (
        <ul class="lista-limpa">
          {lista.map((r) => (
            <li class="cartao" key={r.id}>
              <div class="linha entre">
                <strong>Nº {r.fm.numero} · {dataBR(r.fm.data)}</strong>
                {r.fm.nota_estimada?.total != null && (
                  <span class={`selo ${r.fm.nota_estimada.total >= MINIMO ? 'ok' : 'perigo'}`}>{r.fm.nota_estimada.total}/{MAX}</span>
                )}
              </div>
              <div>{r.fm.tema || <span class="sutil">(sem tema)</span>}</div>
              <div class="sutil pequeno">{r.fm.linhas} linhas · {r.fm.tempo_min} min{r.fm.corrigida_por ? ` · ${r.fm.corrigida_por}` : ''}</div>
              <div class="linha" style="margin-top:6px">
                <button class="btn pequeno" onClick={() => setForm({ id: r.id, fm: { ...vazio(r.fm.numero), ...r.fm }, secoes: r.secoes ?? {} })}>Abrir</button>
                <button class="btn pequeno perigo" onClick={() => { if (confirm('Apagar esta redação?')) void apagar('redacoes', r.id); }}>Apagar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
