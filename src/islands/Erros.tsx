import { useEffect, useMemo, useState } from 'preact/hooks';
import { apagar, obter, salvar, type Registro } from '../lib/dados';
import { useColecao, useParametros } from '../lib/hooks';
import { dataBR, hoje } from '../lib/datas';
import { DISCIPLINAS, NOME_DISCIPLINA, TIPOS_ERRO } from '../lib/disciplinas';
import type { Erro } from '../lib/modelos';
import { lerSecoes, registrarErro } from '../lib/erros';
import { toast } from '../lib/app';
import { CONFIG, origemQuestao } from '../lib/config';

const NOME_TIPO: Record<string, string> = Object.fromEntries(TIPOS_ERRO);

function linkLei(l: string) {
  const m = l?.match(/03-lei-seca\/([\w-]+)\.md(#[\w-]+)?/);
  return m ? `/lei-seca/${m[1]}${m[2] ?? ''}` : null;
}

interface Form {
  fm: Erro;
  enunciado: string;
  marquei: string;
  correta: string;
  porque: string;
  regra: string;
}

const formVazio = (): Form => ({
  fm: { data: hoje(), disciplina: '', assunto: '', origem: '', lei_seca: '', tipo_de_erro: 'nao-sabia', revisoes: 0, dominado: false },
  enunciado: '', marquei: '', correta: '', porque: '', regra: '',
});

function Formulario({ inicial, id, onFim }: { inicial: Form; id?: string; onFim: () => void }) {
  const [f, setF] = useState<Form>(inicial);
  const setFm = <K extends keyof Erro>(k: K, v: Erro[K]) => setF((x) => ({ ...x, fm: { ...x.fm, [k]: v } }));
  const setS = (k: keyof Omit<Form, 'fm'>, v: string) => setF((x) => ({ ...x, [k]: v }));
  const enviar = async (e: Event) => {
    e.preventDefault();
    if (!f.fm.disciplina) { toast('Escolha a disciplina'); return; }
    await registrarErro({ fm: f.fm, enunciado: f.enunciado, marquei: f.marquei, correta: f.correta, porque: f.porque, regra: f.regra }, id);
    toast(id ? 'Erro atualizado' : 'Erro registrado');
    onFim();
  };
  const v = (e: Event) => (e.target as HTMLInputElement).value;
  return (
    <form class="cartao" onSubmit={enviar}>
      <h2>{id ? 'Editar erro' : 'Novo erro'}</h2>
      <div class="campos">
        <div class="campo"><label>Data</label><input type="date" value={f.fm.data} onChange={(e) => setFm('data', v(e))} /></div>
        <div class="campo"><label>Disciplina</label>
          <select value={f.fm.disciplina} onChange={(e) => setFm('disciplina', v(e))} required>
            <option value="">Escolha…</option>
            {DISCIPLINAS.map(([d, n]) => <option value={d}>{n}</option>)}
          </select>
        </div>
        <div class="campo"><label>Tipo de erro</label>
          <select value={f.fm.tipo_de_erro} onChange={(e) => setFm('tipo_de_erro', v(e))}>
            {TIPOS_ERRO.map(([t, n]) => <option value={t}>{n}</option>)}
          </select>
        </div>
      </div>
      <div class="campo"><label>Assunto</label><input value={f.fm.assunto} onInput={(e) => setFm('assunto', v(e))} placeholder="Remédios constitucionais" /></div>
      <div class="campos">
        <div class="campo"><label>Origem</label><input value={f.fm.origem} onInput={(e) => setFm('origem', v(e))} placeholder={origemQuestao(CONFIG.banca, "2024", 47)} /></div>
        <div class="campo"><label>Lei seca</label><input value={f.fm.lei_seca} onInput={(e) => setFm('lei_seca', v(e))} placeholder="03-lei-seca/01-constitucional-cf.md#art-5" /></div>
      </div>
      <div class="campo"><label>Enunciado (resumo)</label><textarea rows={3} value={f.enunciado} onInput={(e) => setS('enunciado', v(e))} /></div>
      <div class="campos">
        <div class="campo"><label>Marquei</label><input value={f.marquei} onInput={(e) => setS('marquei', v(e))} /></div>
        <div class="campo"><label>Correta</label><input value={f.correta} onInput={(e) => setS('correta', v(e))} /></div>
      </div>
      <div class="campo"><label>Por que errei</label><textarea rows={2} value={f.porque} onInput={(e) => setS('porque', v(e))} /></div>
      <div class="campo"><label>Regra certa (literal da lei, quando for Direito)</label><textarea rows={3} value={f.regra} onInput={(e) => setS('regra', v(e))} /></div>
      <div class="linha">
        <button class="btn primario" type="submit">Salvar</button>
        <button class="btn" type="button" onClick={onFim}>Cancelar</button>
      </div>
    </form>
  );
}

function Revisao({ erros, onSair }: { erros: Registro<Erro>[]; onSair: () => void }) {
  const fila = useMemo(
    () => erros.filter((e) => !e.fm.dominado).sort((a, b) => (a.fm.revisoes - b.fm.revisoes) || (Math.random() - 0.5)),
    [],
  );
  const [i, setI] = useState(0);
  const [mostrar, setMostrar] = useState(false);
  if (!fila.length) return <div class="cartao"><p>Nenhum erro pendente nesse filtro. 🎉</p><button class="btn" onClick={onSair}>Voltar</button></div>;
  if (i >= fila.length) return <div class="cartao"><p>Revisão concluída: {fila.length} erro(s).</p><button class="btn primario" onClick={onSair}>Voltar à lista</button></div>;
  const e = fila[i];
  const s = lerSecoes(e.secoes);
  const responder = async (dominado: boolean) => {
    const atual = await obter<Erro>('erros', e.id);
    if (atual) await salvar('erros', e.id, { ...atual.fm, revisoes: (atual.fm.revisoes || 0) + 1, dominado }, atual.secoes);
    setMostrar(false);
    setI(i + 1);
  };
  const lei = linkLei(e.fm.lei_seca);
  return (
    <div class="cartao">
      <div class="linha entre">
        <span class="sutil pequeno">{i + 1} de {fila.length}</span>
        <button class="btn pequeno" onClick={onSair}>Sair da revisão</button>
      </div>
      <div class="linha" style="margin:8px 0">
        <span class="selo info">{NOME_DISCIPLINA[e.fm.disciplina] ?? e.fm.disciplina}</span>
        <span class="selo">{NOME_TIPO[e.fm.tipo_de_erro] ?? e.fm.tipo_de_erro}</span>
        <span class="sutil pequeno">revisado {e.fm.revisoes}×</span>
      </div>
      <h3 style="margin:6px 0">{e.fm.assunto}</h3>
      <p class="sutil pequeno">{e.fm.origem}</p>
      <div class="pre">{s.enunciado || <em class="sutil">(sem enunciado)</em>}</div>
      {s.marquei && <p class="pequeno">Você marcou: <strong>{s.marquei}</strong></p>}
      {!mostrar ? (
        <button class="btn primario" style="width:100%" onClick={() => setMostrar(true)}>Mostrar a regra</button>
      ) : (
        <div>
          {s.correta && <p>Correta: <strong>{s.correta}</strong></p>}
          {s.porque && <p class="pre"><strong>Por que errei:</strong> {s.porque}</p>}
          {s.regra && <blockquote class="pre">{s.regra}</blockquote>}
          {lei && <p><a href={lei} target="_blank">Abrir na lei seca</a></p>}
          <div class="linha">
            <button class="btn" onClick={() => void responder(false)}>Ainda erro</button>
            <button class="btn primario" onClick={() => void responder(true)}>Dominado</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Erros() {
  const params = useParametros();
  const erros = useColecao<Erro>('erros');
  const [disc, setDisc] = useState('');
  const [tipo, setTipo] = useState('');
  const [situacao, setSituacao] = useState('pendentes');
  const [busca, setBusca] = useState('');
  const [modo, setModo] = useState<'lista' | 'novo' | 'editar' | 'revisao'>('lista');
  const [edicao, setEdicao] = useState<{ id?: string; form: Form } | null>(null);

  useEffect(() => {
    if (params.get('novo')) {
      const f = formVazio();
      f.fm.disciplina = params.get('disciplina') ?? '';
      f.fm.assunto = params.get('assunto') ?? '';
      f.fm.lei_seca = params.get('lei') ?? '';
      f.fm.origem = params.get('origem') ?? '';
      setEdicao({ form: f });
      setModo('novo');
    }
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (erros ?? [])
      .filter((e) => (!disc || e.fm.disciplina === disc) && (!tipo || e.fm.tipo_de_erro === tipo))
      .filter((e) => situacao === 'todos' || (situacao === 'dominados' ? e.fm.dominado : !e.fm.dominado))
      .filter((e) => !q || JSON.stringify([e.fm, e.secoes]).toLowerCase().includes(q))
      .sort((a, b) => (a.id < b.id ? 1 : -1));
  }, [erros, disc, tipo, situacao, busca]);

  const fechar = () => { setModo('lista'); setEdicao(null); history.replaceState(null, '', '/erros'); };

  if (modo === 'novo' || modo === 'editar') return <Formulario inicial={edicao?.form ?? formVazio()} id={edicao?.id} onFim={fechar} />;
  if (modo === 'revisao') return <Revisao erros={filtrados} onSair={() => setModo('lista')} />;

  const porTipo = new Map<string, number>();
  for (const e of erros ?? []) if (!e.fm.dominado) porTipo.set(e.fm.tipo_de_erro, (porTipo.get(e.fm.tipo_de_erro) ?? 0) + 1);

  return (
    <div>
      <div class="linha" style="margin-bottom:12px">
        <button class="btn primario" onClick={() => { setEdicao({ form: formVazio() }); setModo('novo'); }}>Novo erro</button>
        <button class="btn" onClick={() => setModo('revisao')} disabled={!filtrados.some((e) => !e.fm.dominado)}>Modo revisão ({filtrados.filter((e) => !e.fm.dominado).length})</button>
      </div>
      <div class="cartao">
        <div class="campos">
          <div class="campo"><label>Disciplina</label>
            <select value={disc} onChange={(e) => setDisc((e.target as HTMLSelectElement).value)}>
              <option value="">Todas</option>
              {DISCIPLINAS.map(([d, n]) => <option value={d}>{n}</option>)}
            </select>
          </div>
          <div class="campo"><label>Tipo de erro</label>
            <select value={tipo} onChange={(e) => setTipo((e.target as HTMLSelectElement).value)}>
              <option value="">Todos</option>
              {TIPOS_ERRO.map(([t, n]) => <option value={t}>{n}{porTipo.get(t) ? ` (${porTipo.get(t)})` : ''}</option>)}
            </select>
          </div>
          <div class="campo"><label>Situação</label>
            <select value={situacao} onChange={(e) => setSituacao((e.target as HTMLSelectElement).value)}>
              <option value="pendentes">Pendentes</option>
              <option value="dominados">Dominados</option>
              <option value="todos">Todos</option>
            </select>
          </div>
        </div>
        <input type="search" placeholder="Buscar no caderno de erros" value={busca} onInput={(e) => setBusca((e.target as HTMLInputElement).value)} />
      </div>

      {erros === null ? <p class="vazio">Carregando…</p> : filtrados.length === 0 ? <p class="vazio">Nenhum erro nesse filtro.</p> : (
        <ul class="lista-limpa">
          {filtrados.map((e) => {
            const s = lerSecoes(e.secoes);
            const lei = linkLei(e.fm.lei_seca);
            return (
              <li class="cartao" key={e.id}>
                <div class="linha entre">
                  <span class="linha">
                    <span class="selo info">{NOME_DISCIPLINA[e.fm.disciplina] ?? e.fm.disciplina}</span>
                    <span class="selo">{NOME_TIPO[e.fm.tipo_de_erro] ?? e.fm.tipo_de_erro}</span>
                    {e.fm.dominado && <span class="selo ok">dominado</span>}
                  </span>
                  <span class="sutil pequeno">{dataBR(e.fm.data)}</span>
                </div>
                <strong style="display:block;margin-top:6px">{e.fm.assunto || '(sem assunto)'}</strong>
                {e.fm.origem && <div class="sutil pequeno">{e.fm.origem}</div>}
                {s.enunciado && <p class="pequeno pre" style="margin:6px 0">{s.enunciado.length > 220 ? s.enunciado.slice(0, 220) + '…' : s.enunciado}</p>}
                <div class="linha" style="margin-top:6px">
                  <button class="btn pequeno" onClick={() => { setEdicao({ id: e.id, form: { fm: { ...formVazio().fm, ...e.fm }, ...s } }); setModo('editar'); }}>Editar</button>
                  {lei && <a class="btn pequeno" href={lei}>Lei seca</a>}
                  <button class="btn pequeno perigo" onClick={() => { if (confirm('Apagar este erro?')) void apagar('erros', e.id); }}>Apagar</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
