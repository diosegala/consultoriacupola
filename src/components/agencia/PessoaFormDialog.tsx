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
} from '@/design-system/design-system-hub-ba3841';
import { useSalvarPessoa, type PessoaDados } from '@/hooks/agencia/useAgenciaEdicao';
import type { AgenciaEspaco, AgenciaPessoa } from '@/hooks/agencia/useAgencia';

const PAPEIS = [
  { valor: 'analista', rotulo: 'Analista' },
  { valor: 'gestor', rotulo: 'Gestor' },
  { valor: 'admin', rotulo: 'Administrador' },
];

function iniciaisDe(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  const primeira = partes[0][0] ?? '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] ?? '' : '';
  return (primeira + ultima).toUpperCase();
}

interface Props {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  pessoa?: AgenciaPessoa | null;
  pessoas: AgenciaPessoa[];
  espacos: AgenciaEspaco[];
  existentes: string[];
}

export function PessoaFormDialog({ aberto, onOpenChange, pessoa, pessoas, espacos, existentes }: Props) {
  const [dados, setDados] = useState<PessoaDados>({
    nome: '',
    email: '',
    iniciais: '',
    funcao: '',
    area_id: espacos[0]?.id ?? '',
    lider_id: null,
    papel: 'analista',
    ativa: true,
    espaco_de_trabalho_liberado: false,
  });
  const salvar = useSalvarPessoa();

  useEffect(() => {
    if (!aberto) return;
    setDados({
      nome: pessoa?.nome ?? '',
      email: pessoa?.email ?? '',
      iniciais: pessoa?.iniciais ?? '',
      funcao: pessoa?.funcao ?? '',
      area_id: pessoa?.area_id ?? espacos[0]?.id ?? '',
      lider_id: pessoa?.lider_id ?? null,
      papel: pessoa?.papel ?? 'analista',
      ativa: pessoa?.ativa !== false,
      espaco_de_trabalho_liberado: false,
    });
  }, [aberto, pessoa, espacos]);

  const set = <K extends keyof PessoaDados>(campo: K, valor: PessoaDados[K]) =>
    setDados((d) => ({ ...d, [campo]: valor }));

  const enviar = () => {
    if (!dados.nome.trim() || !dados.email.trim() || !dados.area_id) return;
    salvar.mutate(
      { pessoa, dados, existentes },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const areas = espacos.filter((e) => e.tipo === 'area');

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pessoa ? 'Editar pessoa' : 'Nova pessoa'}</DialogTitle>
          <DialogDescription>
            Ficha do time da agência. O acesso ao sistema é criado depois, na área de
            usuários, com este mesmo e-mail.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="pe-nome">Nome *</Label>
              <Input
                id="pe-nome"
                value={dados.nome}
                onChange={(e) => {
                  const nome = e.target.value;
                  setDados((d) => ({
                    ...d,
                    nome,
                    iniciais: d.iniciais && pessoa ? d.iniciais : iniciaisDe(nome),
                  }));
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pe-iniciais">Iniciais</Label>
              <Input
                id="pe-iniciais"
                value={dados.iniciais}
                onChange={(e) => set('iniciais', e.target.value.toUpperCase())}
                maxLength={3}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pe-email">E-mail *</Label>
              <Input
                id="pe-email"
                type="email"
                value={dados.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pe-funcao">Função</Label>
              <Input
                id="pe-funcao"
                value={dados.funcao}
                onChange={(e) => set('funcao', e.target.value)}
                placeholder="Ex.: Designer"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>Área</Label>
              <Select value={dados.area_id} onValueChange={(v) => set('area_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Liderança</Label>
              <Select
                value={dados.lider_id ?? 'nenhum'}
                onValueChange={(v) => set('lider_id', v === 'nenhum' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem líder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem líder</SelectItem>
                  {pessoas
                    .filter((p) => p.id !== pessoa?.id)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Papel</Label>
              <Select value={dados.papel} onValueChange={(v) => set('papel', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAPEIS.map((p) => (
                    <SelectItem key={p.valor} value={p.valor}>
                      {p.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Pessoa ativa</p>
              <p className="text-xs text-muted-foreground">
                Pessoas inativas perdem o acesso à agência.
              </p>
            </div>
            <Switch checked={dados.ativa} onCheckedChange={(v) => set('ativa', v)} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Recursos em teste liberados</p>
              <p className="text-xs text-muted-foreground">
                Dá acesso a agentes e recursos que ainda estão em fase de teste.
              </p>
            </div>
            <Switch
              checked={dados.espaco_de_trabalho_liberado}
              onCheckedChange={(v) => set('espaco_de_trabalho_liberado', v)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={enviar}
            disabled={salvar.isPending || !dados.nome.trim() || !dados.email.trim() || !dados.area_id}
          >
            <Save className="mr-2 h-4 w-4" />
            {salvar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
