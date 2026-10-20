// Cronômetro Pomodoro. O estado fica no localStorage, então recarregar a página não perde a contagem.
import { useEffect, useState } from 'preact/hooks';
import { CONFIG } from '../lib/config';

interface Estado {
  modo: 'estudo' | 'pausa';
  fimEm: number | null; // quando rodando
  restanteMs: number; // quando parado
  restanteNoInicio: number;
  estudadoMs: number;
  inicio: string | null; // HH:MM da primeira partida
}
interface Cfg { estudo: number; pausa: number }

const CHAVE = 'caderno_pomodoro';
const CHAVE_CFG = 'caderno_pomodoro_cfg';
// Duração dos blocos: concurso.config.json (estudo.pomodoro_*).
const fimDeSemana = [0, 6].includes(new Date().getDay());
const CFG_PADRAO: Cfg = {
  estudo: fimDeSemana ? CONFIG.estudo.pomodoro_fim_de_semana : CONFIG.estudo.pomodoro_dias_uteis,
  pausa: CONFIG.estudo.pausa,
};

function ler<T>(k: string, padrao: T): T {
  try { const v = localStorage.getItem(k); return v ? { ...padrao, ...JSON.parse(v) } : padrao; } catch { return padrao; }
}
function gravar(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

function novoEstado(cfg: Cfg): Estado {
  const ms = cfg.estudo * 60_000;
  return { modo: 'estudo', fimEm: null, restanteMs: ms, restanteNoInicio: ms, estudadoMs: 0, inicio: null };
}

function bip() {
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
  } catch {}
  try { navigator.vibrate?.([300, 150, 300]); } catch {}
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export function estudadoAgora(e: Estado): number {
  if (e.fimEm && e.modo === 'estudo') return e.estudadoMs + (e.restanteNoInicio - Math.max(0, e.fimEm - Date.now()));
  return e.estudadoMs;
}

interface Props {
  onTempo: (minutos: number, inicio: string | null) => void;
  zerar?: number; // muda de valor para zerar o cronômetro (depois de salvar)
}

export default function Pomodoro({ onTempo, zerar }: Props) {
  const [cfg, setCfg] = useState<Cfg>(() => ler(CHAVE_CFG, CFG_PADRAO));
  const [e, setE] = useState<Estado>(() => ler(CHAVE, novoEstado(ler(CHAVE_CFG, CFG_PADRAO))));
  const [, tick] = useState(0);
  const [cfgAberta, setCfgAberta] = useState(false);

  const atualizar = (n: Estado) => { setE(n); gravar(CHAVE, n); };

  useEffect(() => {
    if (zerar) atualizar(novoEstado(cfg));
  }, [zerar]);

  useEffect(() => {
    const id = setInterval(() => {
      tick((x) => x + 1);
      setE((atual) => {
        if (!atual.fimEm || Date.now() < atual.fimEm) return atual;
        bip();
        const fimEstudo = atual.modo === 'estudo';
        const prox: Estado = {
          ...atual,
          modo: fimEstudo ? 'pausa' : 'estudo',
          fimEm: null,
          estudadoMs: fimEstudo ? atual.estudadoMs + atual.restanteNoInicio : atual.estudadoMs,
          restanteMs: (fimEstudo ? cfg.pausa : cfg.estudo) * 60_000,
          restanteNoInicio: (fimEstudo ? cfg.pausa : cfg.estudo) * 60_000,
        };
        gravar(CHAVE, prox);
        try { document.title = fimEstudo ? '⏸ Pausa!' : '▶ Voltar ao estudo'; } catch {}
        return prox;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [cfg]);

  const minutos = Math.round(estudadoAgora(e) / 60_000);
  useEffect(() => { onTempo(minutos, e.inicio); }, [minutos, e.inicio]);

  const rodando = e.fimEm !== null;
  const restante = rodando ? e.fimEm! - Date.now() : e.restanteMs;

  const iniciar = () => {
    const agora = new Date();
    const hhmm = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    atualizar({ ...e, fimEm: Date.now() + e.restanteMs, restanteNoInicio: e.restanteMs, inicio: e.inicio ?? hhmm });
  };
  const pausar = () => {
    const rest = Math.max(0, e.fimEm! - Date.now());
    atualizar({
      ...e,
      fimEm: null,
      restanteMs: rest,
      restanteNoInicio: rest,
      estudadoMs: e.modo === 'estudo' ? e.estudadoMs + (e.restanteNoInicio - rest) : e.estudadoMs,
    });
  };
  const pular = () => {
    const base = rodando ? Math.max(0, e.fimEm! - Date.now()) : e.restanteMs;
    const estudado = e.modo === 'estudo' ? e.estudadoMs + (e.restanteNoInicio - base) : e.estudadoMs;
    const modo = e.modo === 'estudo' ? 'pausa' : 'estudo';
    const ms = (modo === 'estudo' ? cfg.estudo : cfg.pausa) * 60_000;
    atualizar({ ...e, modo, fimEm: null, restanteMs: ms, restanteNoInicio: ms, estudadoMs: estudado });
  };
  const reiniciar = () => {
    if (e.estudadoMs > 60_000 && !confirm('Zerar o cronômetro e o tempo estudado?')) return;
    atualizar(novoEstado(cfg));
  };

  return (
    <div class={`cartao pomodoro ${e.modo}`}>
      <div class="linha entre">
        <span class={`selo ${e.modo === 'estudo' ? 'info' : 'ok'}`}>{e.modo === 'estudo' ? `Estudo (${cfg.estudo} min)` : `Pausa (${cfg.pausa} min)`}</span>
        <button class="btn-icone pequeno" type="button" onClick={() => setCfgAberta(!cfgAberta)}>Ajustar tempos</button>
      </div>
      <div class="relogio" aria-live="off">{fmt(restante)}</div>
      <div class="linha" style="justify-content:center">
        {rodando ? (
          <button class="btn primario" type="button" onClick={pausar}>Pausar</button>
        ) : (
          <button class="btn primario" type="button" onClick={iniciar}>{e.estudadoMs || e.restanteMs !== e.restanteNoInicio ? 'Continuar' : 'Iniciar'}</button>
        )}
        <button class="btn" type="button" onClick={pular}>{e.modo === 'estudo' ? 'Ir para pausa' : 'Pular pausa'}</button>
        <button class="btn" type="button" onClick={reiniciar}>Zerar</button>
      </div>
      <p class="sutil pequeno" style="text-align:center;margin:8px 0 0">Tempo estudado nesta sessão: <strong>{minutos} min</strong>{e.inicio ? ` · início ${e.inicio}` : ''}</p>
      {cfgAberta && (
        <div class="campos" style="margin-top:10px">
          <div class="campo">
            <label>Estudo (min)</label>
            <input type="number" min={5} max={180} value={cfg.estudo} onChange={(ev) => { const c = { ...cfg, estudo: Number((ev.target as HTMLInputElement).value) || 45 }; setCfg(c); gravar(CHAVE_CFG, c); }} />
          </div>
          <div class="campo">
            <label>Pausa (min)</label>
            <input type="number" min={1} max={60} value={cfg.pausa} onChange={(ev) => { const c = { ...cfg, pausa: Number((ev.target as HTMLInputElement).value) || 10 }; setCfg(c); gravar(CHAVE_CFG, c); }} />
          </div>
        </div>
      )}
    </div>
  );
}
