import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ChevronLeft, ChevronRight, Lock, LockOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { agencia } from '@/integrations/supabase/agencia';
import { useAgenciaClientes } from '@/hooks/agencia/useAgencia';
import { CabecalhoPagina, Vazio } from '@/components/agencia/CabecalhoPagina';
import { SeloConta } from '@/components/agencia/cliente/SeloConta';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function andar(mes: string, n: number) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function nomeDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

interface Resumo {
  briefing: boolean;
  fechada: string | null;
  temas: number;
  textos: number;
  artes: number;
}

function useResumoDoMes(mes: string) {
  return useQuery({
    queryKey: ['agencia', 'redes-resumo', mes],
    queryFn: async (): Promise<Record<string, Resumo>> => {
      const [meses, temas, artes] = await Promise.all([
        agencia().from('redes_conteudo_meses').select('cliente_id, briefing, producao_fechada_em').eq('mes', mes),
        agencia().from('redes_conteudo_temas').select('id, cliente_id, legenda').eq('mes', mes),
        agencia().from('redes_artes').select('tema_id, cliente_id').eq('tipo', 'arte_final'),
      ]);
      if (meses.error) throw meses.error;
      if (temas.error) throw temas.error;
      const r: Record<string, Resumo> = {};
      const de = (id: string) => (r[id] ??= { briefing: false, fechada: null, temas: 0, textos: 0, artes: 0 });
      for (const m of meses.data ?? []) {
        const x = de(m.cliente_id);
        x.briefing = !!String(m.briefing ?? '').trim();
        x.fechada = m.producao_fechada_em;
      }
      const doMes = new Set<string>();
      for (const t of temas.data ?? []) {
        const x = de(t.cliente_id);
        x.temas++;
        if (String(t.legenda ?? '').trim()) x.textos++;
        doMes.add(t.id);
      }
      const comArte = new Set<string>();
      for (const a of artes.data ?? []) {
        if (a.tema_id && doMes.has(a.tema_id) && !comArte.has(a.tema_id)) {
          comArte.add(a.tema_id);
          de(a.cliente_id).artes++;
        }
      }
      return r;
    },
  });
}

function situacao(r?: Resumo): { rotulo: string; variante: 'default' | 'secondary' | 'outline' } {
  if (!r || (!r.briefing && !r.temas)) return { rotulo: 'Não começou', variante: 'outline' };
  if (r.fechada) return { rotulo: 'Produção fechada', variante: 'default' };
  if (r.temas && r.artes >= r.temas) return { rotulo: 'Artes prontas', variante: 'secondary' };
  if (r.textos) return { rotulo: 'Em produção', variante: 'secondary' };
  if (r.temas) return { rotulo: 'Temas sugeridos', variante: 'secondary' };
  return { rotulo: 'Briefing', variante: 'outline' };
}

export default function AgenciaRedesMes() {
  const [params, setParams] = useSearchParams();
  const mes = params.get('mes') || mesAtual();
  const [filtro, setFiltro] = useState<'todos' | 'pendentes' | 'fechados'>('todos');
  const qc = useQueryClient();
  const { data: clientes, isLoading } = useAgenciaClientes();
  const { data: resumo, isLoading: carregando } = useResumoDoMes(mes);

  const ativos = useMemo(
    () => (clientes ?? []).filter((c) => !(c as { arquivado?: boolean }).arquivado),
    [clientes],
  );
  const lista = ativos.filter((c) => {
    const r = resumo?.[c.id];
    if (filtro === 'fechados') return !!r?.fechada;
    if (filtro === 'pendentes') return !r?.fechada;
    return true;
  });
  const fechados = ativos.filter((c) => resumo?.[c.id]?.fechada).length;

  const alternarFechamento = async (clienteId: string, fechada: boolean) => {
    const { error } = await agencia()
      .from('redes_conteudo_meses')
      .upsert(
        { cliente_id: clienteId, mes, producao_fechada_em: fechada ? null : new Date().toISOString(), atualizado_em: new Date().toISOString() },
        { onConflict: 'cliente_id,mes' },
      );
    if (error) return toast.error(error.message);
    toast.success(fechada ? 'Produção reaberta.' : 'Produção do mês fechada.');
    qc.invalidateQueries({ queryKey: ['agencia', 'redes-resumo', mes] });
  };

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        rotulo="Produção"
        titulo="Conteúdo de redes por mês"
        descricao={`${fechados} de ${ativos.length} clientes com a produção de ${nomeDoMes(mes)} fechada`}
        acoes={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => setParams({ mes: andar(mes, -1) })}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-40 text-center text-sm font-medium capitalize">{nomeDoMes(mes)}</span>
            <Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => setParams({ mes: andar(mes, 1) })}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(['todos', 'pendentes', 'fechados'] as const).map((f) => (
          <Button key={f} size="sm" variant={filtro === f ? 'default' : 'outline'} className="rounded-full" onClick={() => setFiltro(f)}>
            {f === 'todos' ? 'Todos' : f === 'pendentes' ? 'Em aberto' : 'Fechados'}
          </Button>
        ))}
      </div>

      {isLoading || carregando ? (
        <Skeleton className="h-64 w-full" />
      ) : lista.length === 0 ? (
        <Vazio>Nenhum cliente neste filtro.</Vazio>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((c) => {
            const r = resumo?.[c.id];
            const s = situacao(r);
            const pct = r?.temas ? Math.round(((r.textos + r.artes) / (r.temas * 2)) * 100) : 0;
            return (
              <div key={c.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  <SeloConta cliente={c} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{c.nome}</p>
                    <Badge variant={s.variante} className="mt-1">{s.rotulo}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[['Temas', r?.temas ?? 0], ['Textos', r?.textos ?? 0], ['Artes', r?.artes ?? 0]].map(([n, v]) => (
                    <div key={n as string} className="rounded-xl bg-muted p-2">
                      <p className="text-lg font-bold text-foreground">{v}</p>
                      <p className="text-xs text-muted-foreground">{n}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Andamento</span>
                    <span>{pct}%</span>
                  </div>
                  <Progress value={pct} />
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <Button size="sm" variant="ghost" onClick={() => alternarFechamento(c.id, !!r?.fechada)}>
                    {r?.fechada ? <LockOpen className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                    {r?.fechada ? 'Reabrir' : 'Fechar produção'}
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/agencia/contas/${c.slug}/redes?mes=${mes}`}>
                      Abrir mês
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
