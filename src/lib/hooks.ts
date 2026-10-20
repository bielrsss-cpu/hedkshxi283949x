import { useEffect, useState } from 'preact/hooks';
import { assinar, listar, type Colecao, type Registro } from './dados';

/** Lista uma coleção e se atualiza quando os dados mudam (inclusive pela sincronização). */
export function useColecao<F = Record<string, any>>(col: Colecao): Registro<F>[] | null {
  const [itens, setItens] = useState<Registro<F>[] | null>(null);
  useEffect(() => {
    let vivo = true;
    const carregar = () => listar<F>(col).then((r) => vivo && setItens(r));
    carregar();
    const sair = assinar((c) => { if (!c || c === col) carregar(); });
    return () => { vivo = false; sair(); };
  }, [col]);
  return itens;
}

export function useParametros(): URLSearchParams {
  const [p] = useState(() => new URLSearchParams(typeof location !== 'undefined' ? location.search : ''));
  return p;
}
