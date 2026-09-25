import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/design-system/design-system-hub-ba3841';
import { useSalvarProjeto, type ProjetoDados } from '@/hooks/agencia/useAgenciaEdicao';
import type { AgenciaCliente, AgenciaEspaco, AgenciaProjeto } from '@/hooks/agencia/useAgencia';

// Os mesmos valores aceitos pelo banco (check em agencia.projetos.status), como no CupolaOS.
const STATUS = [
  { valor: 'ativo', rotulo: 'Ativo' },
  { valor: 'pausado', rotulo: 'Pausado' },
  { valor: 'concluido', rotulo: 'Concluído' },
];

interface Props {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  projeto?: AgenciaProjeto | null;
  clienteId?: string;
  clientes: AgenciaCliente[];
  espacos: AgenciaEspaco[];
  pessoaId: string;
  existentes: string[];
}

export function ProjetoFormDialog({
  aberto,
  onOpenChange,
  projeto,
  clienteId,
  clientes,
  espacos,
  pessoaId,
  existentes,
}: Props) {
  const [dados, setDados] = useState<ProjetoDados>({
    nome: '',
    cliente_id: clienteId ?? clientes[0]?.id ?? '',
    espaco_id: espacos[0]?.id ?? '',
    status: 'ativo',
    resumo: '',
    contexto: '',
  });
  const salvar = useSalvarProjeto();

  useEffect(() => {
    if (!aberto) return;
    setDados({
      nome: projeto?.nome ?? '',
      cliente_id: projeto?.cliente_id ?? clienteId ?? clientes[0]?.id ?? '',
      espaco_id: projeto?.espaco_id ?? espacos[0]?.id ?? '',
      status: projeto?.status ?? 'ativo',
      resumo: projeto?.resumo ?? '',
      contexto: '',
    });
  }, [aberto, projeto, clienteId, clientes, espacos]);

  const set = (campo: keyof ProjetoDados, valor: string) =>
    setDados((d) => ({ ...d, [campo]: valor }));

  const enviar = () => {
    if (!dados.nome.trim() || !dados.cliente_id || !dados.espaco_id) return;
    salvar.mutate(
      { projeto, dados, pessoaId, existentes },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{projeto ? 'Editar projeto' : 'Novo projeto'}</DialogTitle>
          <DialogDescription>
            Trabalhos pontuais ligados a uma conta da carteira.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="pr-nome">Nome *</Label>
            <Input
              id="pr-nome"
              value={dados.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Ex.: Campanha de lançamento"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2 sm:col-span-2">
              <Label>Conta</Label>
              <Select
                value={dados.cliente_id}
                onValueChange={(v) => set('cliente_id', v)}
                disabled={!!clienteId && !projeto}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a conta" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Situação</Label>
              <Select value={dados.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => (
                    <SelectItem key={s.valor} value={s.valor}>
                      {s.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Área</Label>
            <Select value={dados.espaco_id} onValueChange={(v) => set('espaco_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha a área" />
              </SelectTrigger>
              <SelectContent>
                {espacos.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pr-resumo">Resumo</Label>
            <Textarea
              id="pr-resumo"
              rows={2}
              value={dados.resumo}
              onChange={(e) => set('resumo', e.target.value)}
            />
          </div>

          {!projeto && (
            <div className="grid gap-2">
              <Label htmlFor="pr-contexto">Contexto (opcional)</Label>
              <Textarea
                id="pr-contexto"
                rows={3}
                value={dados.contexto}
                onChange={(e) => set('contexto', e.target.value)}
                placeholder="Briefing rápido, referências e combinados."
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={enviar}
            disabled={salvar.isPending || !dados.nome.trim() || !dados.cliente_id || !dados.espaco_id}
          >
            <Save className="mr-2 h-4 w-4" />
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
