import { useState } from 'react';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, Progress,
} from '@/design-system/design-system-hub-ba3841';
import { useAgenciaProdutos, type AgenciaProduto } from '@/hooks/agencia/useAgenciaBase';
import { CabecalhoPagina, Vazio } from '@/components/agencia/CabecalhoPagina';

const STATUS: Record<string, string> = { ativo: 'Ativo', rascunho: 'Rascunho', encerrado: 'Encerrado' };
const MODALIDADE: Record<string, string> = { presencial: 'Presencial', online: 'Online', hibrido: 'Híbrido' };
const data = (d?: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR') : '');
const reais = (v?: number | null) =>
  v == null ? '' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function AgenciaProdutos() {
  const { data: produtos = [], isLoading } = useAgenciaProdutos();
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<AgenciaProduto | null>(null);
  const termo = busca.trim().toLowerCase();
  const visiveis = termo
    ? produtos.filter((p) => `${p.nome} ${p.tipo ?? ''} ${p.resumo ?? ''}`.toLowerCase().includes(termo))
    : produtos;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        rotulo="Base interna"
        titulo="Produtos"
        descricao="O que a Cupola vende: imersões, treinamentos e eventos. O que é, para quem, quanto custa."
        acoes={<span className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">{produtos.length} produtos</span>}
      />
      <div className="w-full sm:w-80">
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto" />
      </div>
      {isLoading ? (
        <Vazio>Carregando…</Vazio>
      ) : visiveis.length === 0 ? (
        <Vazio>{produtos.length === 0 ? 'Nenhum produto cadastrado ainda.' : 'Nenhum produto com esse nome.'}</Vazio>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((p) => {
            const pct = p.vagas ? Math.min(100, Math.round(((p.vendidas ?? 0) / p.vagas) * 100)) : null;
            return (
              <button
                key={p.id}
                onClick={() => setAberto(p)}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{p.tipo}</span>
                  {p.status && (
                    <span className={p.status === 'ativo' ? 'text-xs font-medium text-success' : 'text-xs text-muted-foreground'}>
                      {STATUS[p.status] ?? p.status}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{p.nome}</p>
                  {(p.tagline || p.resumo) && <p className="line-clamp-2 text-sm text-muted-foreground">{p.tagline || p.resumo}</p>}
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {p.inicio && <p className="flex items-center gap-2"><CalendarDays className="h-3 w-3" />{data(p.inicio)}{p.fim && ` a ${data(p.fim)}`}</p>}
                  {(p.local || p.modalidade) && <p className="flex items-center gap-2"><MapPin className="h-3 w-3" />{[p.local, p.modalidade && MODALIDADE[p.modalidade]].filter(Boolean).join(' · ')}</p>}
                  {p.vagas != null && <p className="flex items-center gap-2"><Users className="h-3 w-3" />{p.vendidas ?? 0} de {p.vagas} vagas</p>}
                </div>
                {pct != null && <Progress value={pct} />}
              </button>
            );
          })}
        </div>
      )}
      <Dialog open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{aberto?.nome}</DialogTitle>
            {aberto?.tagline && <DialogDescription>{aberto.tagline}</DialogDescription>}
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-auto text-sm">
            {[
              ['Sobre', aberto?.sobre],
              ['Para quem', aberto?.publico_alvo],
              ['Proposta de valor', aberto?.proposta_de_valor],
              ['Preço de referência', reais(aberto?.preco_referencia)],
            ].filter(([, v]) => v).map(([t, v]) => (
              <div key={t as string}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t}</p>
                <p className="whitespace-pre-wrap text-foreground">{v}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
