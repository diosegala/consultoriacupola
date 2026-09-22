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
  Switch,
  Textarea,
} from '@/design-system/design-system-hub-ba3841';
import { useSalvarAgente } from '@/hooks/agencia/useAgenciaEdicao';
import type { AgenciaAgente, AgenciaEspaco } from '@/hooks/agencia/useAgencia';

interface Props {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  agente: AgenciaAgente;
  espacos: AgenciaEspaco[];
}

export function AgenteFormDialog({ aberto, onOpenChange, agente, espacos }: Props) {
  const [dados, setDados] = useState({
    nome: agente.nome,
    resumo: agente.resumo ?? '',
    descricao: agente.descricao ?? '',
    glifo: agente.glifo ?? '',
    espaco_id: agente.espaco_id ?? espacos[0]?.id ?? '',
    ordem: agente.ordem != null ? String(agente.ordem) : '0',
    destaque: agente.destaque ?? false,
    beta: agente.beta ?? false,
    oculto: agente.oculto ?? false,
    por_conta: agente.por_conta ?? false,
  });
  const salvar = useSalvarAgente();

  useEffect(() => {
    if (!aberto) return;
    setDados({
      nome: agente.nome,
      resumo: agente.resumo ?? '',
      descricao: agente.descricao ?? '',
      glifo: agente.glifo ?? '',
      espaco_id: agente.espaco_id ?? espacos[0]?.id ?? '',
      ordem: agente.ordem != null ? String(agente.ordem) : '0',
      destaque: agente.destaque ?? false,
      beta: agente.beta ?? false,
      oculto: agente.oculto ?? false,
      por_conta: agente.por_conta ?? false,
    });
  }, [aberto, agente, espacos]);

  const set = (campo: keyof typeof dados, valor: string | boolean) =>
    setDados((d) => ({ ...d, [campo]: valor }));

  const enviar = () => {
    if (!dados.nome.trim()) return;
    salvar.mutate(
      {
        agente,
        dados: {
          nome: dados.nome,
          resumo: dados.resumo,
          descricao: dados.descricao,
          glifo: dados.glifo,
          espaco_id: dados.espaco_id,
          ordem: Number(dados.ordem) || 0,
          destaque: dados.destaque,
          beta: dados.beta,
          oculto: dados.oculto,
          por_conta: dados.por_conta,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const alternar = (campo: 'destaque' | 'beta' | 'oculto' | 'por_conta', rotulo: string, ajuda: string) => (
    <div key={campo} className="flex items-center justify-between rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-medium">{rotulo}</p>
        <p className="text-xs text-muted-foreground">{ajuda}</p>
      </div>
      <Switch
        checked={dados[campo]}
        onCheckedChange={(v) => set(campo, v)}
      />
    </div>
  );

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar agente</DialogTitle>
          <DialogDescription>
            Ajuste a apresentação e a visibilidade de {agente.nome} no catálogo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="grid gap-2 sm:col-span-3">
              <Label htmlFor="ag-nome">Nome *</Label>
              <Input id="ag-nome" value={dados.nome} onChange={(e) => set('nome', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ag-glifo">Glifo</Label>
              <Input
                id="ag-glifo"
                value={dados.glifo}
                onChange={(e) => set('glifo', e.target.value)}
                maxLength={4}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ag-resumo">Resumo</Label>
            <Input
              id="ag-resumo"
              value={dados.resumo}
              onChange={(e) => set('resumo', e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ag-descricao">Descrição</Label>
            <Textarea
              id="ag-descricao"
              rows={3}
              value={dados.descricao}
              onChange={(e) => set('descricao', e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2 sm:col-span-2">
              <Label>Espaço</Label>
              <Select value={dados.espaco_id} onValueChange={(v) => set('espaco_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha" />
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
              <Label htmlFor="ag-ordem">Ordem</Label>
              <Input
                id="ag-ordem"
                type="number"
                value={dados.ordem}
                onChange={(e) => set('ordem', e.target.value)}
              />
            </div>
          </div>

          {alternar('destaque', 'Destaque', 'Aparece em evidência no catálogo.')}
          {alternar('beta', 'Beta', 'Só aparece para quem tem recursos em teste liberados.')}
          {alternar('oculto', 'Oculto', 'Fica fora do catálogo para todo mundo.')}
          {alternar('por_conta', 'Específico de conta', 'Agente dedicado a uma única conta.')}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={salvar.isPending || !dados.nome.trim()}>
            <Save className="mr-2 h-4 w-4" />
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
