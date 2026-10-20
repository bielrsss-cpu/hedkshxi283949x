import { useMemo } from 'preact/hooks';
import { useColecao } from '../lib/hooks';
import { NOME_DISCIPLINA } from '../lib/disciplinas';
import type { Resposta } from './Resolver';

interface ProvaResumo { ano: string; titulo: string; total: number; disciplinas: Record<string, number>; discDe: Record<number, string> }

export default function ListaProvas({ provas }: { provas: ProvaResumo[] }) {
  const reg = useColecao<Resposta>('respostas');
  const porProva = useMemo(() => {
    const m = new Map<string, Resposta[]>();
    for (const r of reg ?? []) m.set(r.fm.prova, [...(m.get(r.fm.prova) ?? []), r.fm]);
    return m;
  }, [reg]);

  const porDisc = new Map<string, { feitas: number; certas: number }>();
  for (const p of provas) {
    for (const r of porProva.get(p.ano) ?? []) {
      const d = p.discDe[r.questao];
      const x = porDisc.get(d) ?? { feitas: 0, certas: 0 };
      x.feitas++;
      if (r.acertou) x.certas++;
      porDisc.set(d, x);
    }
  }

  return (
    <div>
      {provas.map((p) => {
        const rs = porProva.get(p.ano) ?? [];
        const certas = rs.filter((r) => r.acertou).length;
        const erradas = rs.length - certas;
        return (
          <div class="cartao" key={p.ano}>
            <div class="linha entre">
              <strong>{p.titulo}</strong>
              <span class="selo">{p.total} questões</span>
            </div>
            <div class="barra" style="margin:8px 0"><span style={{ width: `${(rs.length / p.total) * 100}%` }} /></div>
            <p class="pequeno sutil" style="margin:0 0 8px">{rs.length} respondidas · {certas} certas · {erradas} erradas</p>
            <div class="linha">
              <a class="btn primario" href={`/questoes/${p.ano}${rs.length && rs.length < p.total ? '?s=nao-respondidas' : ''}`}>{rs.length ? (rs.length < p.total ? 'Continuar' : 'Rever') : 'Começar'}</a>
              {erradas > 0 && <a class="btn" href={`/questoes/${p.ano}?s=erradas`}>Refazer as erradas</a>}
            </div>
            <details style="margin-top:8px">
              <summary class="pequeno">Resolver por disciplina</summary>
              <div class="linha" style="margin-top:6px">
                {Object.entries(p.disciplinas).map(([d, n]) => (
                  <a class="btn pequeno" href={`/questoes/${p.ano}?d=${d}`}>{NOME_DISCIPLINA[d] ?? d} ({n})</a>
                ))}
              </div>
            </details>
          </div>
        );
      })}
      {porDisc.size > 0 && (
        <div class="cartao">
          <h2>Acertos por disciplina (provas)</h2>
          <table>
            <thead><tr><th>Disciplina</th><th>Acertos</th><th>%</th></tr></thead>
            <tbody>
              {[...porDisc].map(([d, x]) => {
                const pc = Math.round((x.certas / x.feitas) * 100);
                return <tr key={d}><td>{NOME_DISCIPLINA[d] ?? d}</td><td>{x.certas}/{x.feitas}</td><td><span class={`selo ${pc >= 75 ? 'ok' : pc >= 50 ? 'pendente' : 'perigo'}`}>{pc}%</span></td></tr>;
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
