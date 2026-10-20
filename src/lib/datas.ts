// Datas no fuso local, sempre como texto AAAA-MM-DD.
export function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export const hoje = () => iso(new Date());
export function deISO(s: string): Date {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, m - 1, d);
}
export function somarDias(s: string, n: number): string {
  const d = deISO(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
export function diasEntre(a: string, b: string): number {
  return Math.round((deISO(b).getTime() - deISO(a).getTime()) / 86_400_000);
}
export function horaAgora(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function dataBR(s: string): string {
  if (!s) return '';
  const [a, m, d] = s.split('-');
  return `${d}/${m}/${a}`;
}
export interface SemanaInfo { id: string; inicio: string; fim: string }
export function semanaDe<T extends SemanaInfo>(data: string, semanas: T[]): T | undefined {
  return semanas.find((s) => data >= s.inicio && data <= s.fim);
}
