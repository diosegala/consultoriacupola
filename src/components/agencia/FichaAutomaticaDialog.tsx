import { useEffect, useState } from 'react';
import { Sparkles, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useFichaAutomatica, type RegraSugerida } from '@/hooks/agencia/useAgenciaFicha';

const NOMES: Record<string, string> = {
  resumo: 'Contexto',
  setor_descricao: 'Setor',
  publico_alvo: 'Público-alvo',
  tom_de_voz: 'Tom de voz',
  produtos_servicos: 'Produtos e serviços',
  posicionamento: 'Posicionamento',
  diferenciais: 'Diferenciais',
  concorrencia: 'Concorrência',
  palavras_chave: 'Palavras-chave',
};

const TIPO_REGRA: Record<string, string> = {
  veto: 'Não pode',
  obrigatorio: 'Obrigatório',
  posicionamento: 'Posicionamento',
};

interface Props {
  clienteId: string;
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
}

export function FichaAutomaticaDialog({ clienteId, aberto, onOpenChange }: Props) {
  const { lendo, salvando, leitura, ler, aplicar, limpar } = useFichaAutomatica(clienteId);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [aprovados, setAprovados] = useState<Record<string, boolean>>({});
  const [regrasOk, setRegrasOk] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!leitura) return;
    const t: Record<string, string> = {};
    const a: Record<string, boolean> = {};
    leitura.sugestoes.forEach((s) => {
      t[s.campo] = s.valor;
      a[s.campo] = !!s.valor.trim();
    });
    setTextos(t);
    setAprovados(a);
    setRegrasOk(Object.fromEntries(leitura.regras.map((_, i) => [i, true])));
  }, [leitura]);

  useEffect(() => {
    if (!aberto) limpar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const preenchidas = (leitura?.sugestoes ?? []).filter((s) => s.valor.trim());
  const vazias = (leitura?.sugestoes ?? []).filter((s) => !s.valor.trim());

  const salvar = async () => {
    const campos: Record<string, string> = {};
    Object.entries(aprovados).forEach(([campo, ok]) => {
      if (ok && textos[campo]?.trim()) campos[campo] = textos[campo];
    });
    const regras: RegraSugerida[] = (leitura?.regras ?? []).filter((_, i) => regrasOk[i]);
    const ok = await aplicar(campos, regras);
    if (ok) onOpenChange(false);
  };

  const nadaSelecionado =
    !Object.values(aprovados).some(Boolean) && !Object.values(regrasOk).some(Boolean);

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Preencher ficha com o material da conta
          </DialogTitle>
          <DialogDescription>
            A leitura propõe, você aprova. Cada proposta mostra de onde saiu — confira antes de
            salvar.
          </DialogDescription>
        </DialogHeader>

        {!leitura ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="max-w-md text-sm text-muted-foreground">
              Vamos ler os materiais já enviados desta conta e sugerir o preenchimento dos campos do
              perfil, além das regras que a conta exige.
            </p>
            <Button onClick={ler} disabled={lendo}>
              {lendo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Lendo o material…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Ler o material
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              {leitura.documentos.length} documento(s) lido(s)
              {leitura.acrescimo && <Badge variant="outline">só o que acrescenta</Badge>}
              {leitura.cortados.length > 0 && (
                <span className="text-amber-500">
                  material muito longo, foi lido em parte: {leitura.cortados.join(', ')}
                </span>
              )}
            </div>

            <ScrollArea className="max-h-[52vh] pr-3">
              <div className="space-y-4">
                {preenchidas.map((s) => (
                  <div key={s.campo} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <Checkbox
                          checked={!!aprovados[s.campo]}
                          onCheckedChange={(v) =>
                            setAprovados((a) => ({ ...a, [s.campo]: v === true }))
                          }
                        />
                        {NOMES[s.campo] ?? s.campo}
                      </label>
                      {s.fontes.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-xs">
                              {s.fontes.length} fonte(s)
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-96 space-y-2 text-xs">
                            {s.fontes.map((f, i) => (
                              <div key={i}>
                                <p className="font-medium">{f.origem}</p>
                                <p className="text-muted-foreground">“{f.trecho}”</p>
                              </div>
                            ))}
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                    <Textarea
                      className="mt-2 text-sm"
                      rows={s.campo === 'resumo' ? 5 : 3}
                      value={textos[s.campo] ?? ''}
                      onChange={(e) => setTextos((t) => ({ ...t, [s.campo]: e.target.value }))}
                    />
                  </div>
                ))}

                {vazias.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Sem resposta no material:{' '}
                    {vazias.map((s) => NOMES[s.campo] ?? s.campo).join(', ')}.
                  </p>
                )}

                {leitura.regras.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Regras propostas</p>
                    {leitura.regras.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg border border-border p-3">
                        <Checkbox
                          checked={!!regrasOk[i]}
                          onCheckedChange={(v) => setRegrasOk((s) => ({ ...s, [i]: v === true }))}
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{TIPO_REGRA[r.tipo] ?? r.tipo}</Badge>
                            <span className="text-sm">{r.texto}</span>
                          </div>
                          {r.porque && (
                            <p className="text-xs text-muted-foreground">{r.porque}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={ler} disabled={lendo || salvando}>
                Ler de novo
              </Button>
              <Button onClick={salvar} disabled={salvando || nadaSelecionado}>
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar o que aprovei
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
