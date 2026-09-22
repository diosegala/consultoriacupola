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
import { useSalvarConta, type ContaDados } from '@/hooks/agencia/useAgenciaEdicao';
import type { AgenciaCliente } from '@/hooks/agencia/useAgencia';

const TIPOS = [
  { valor: 'imobiliaria', rotulo: 'Imobiliária' },
  { valor: 'incorporadora', rotulo: 'Incorporadora' },
  { valor: 'servicos', rotulo: 'Serviços' },
];

const VAZIO: ContaDados = {
  nome: '',
  sigla: '',
  tipo: 'servicos',
  cidade: '',
  desde: new Date().toISOString().slice(0, 10),
  resumo: '',
  setor_descricao: '',
  publico_alvo: '',
  tom_de_voz: '',
  produtos_servicos: '',
  posicionamento: '',
  diferenciais: '',
  concorrencia: '',
  palavras_chave: '',
  contato_nome: '',
  contato_cargo: '',
  contato_email: '',
  contato_telefone: '',
};

interface Props {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  conta?: AgenciaCliente | null;
  existentes: string[];
}

export function ContaFormDialog({ aberto, onOpenChange, conta, existentes }: Props) {
  const [dados, setDados] = useState<ContaDados>(VAZIO);
  const [mais, setMais] = useState(false);
  const salvar = useSalvarConta();

  useEffect(() => {
    if (!aberto) return;
    if (conta) {
      setDados({
        nome: conta.nome ?? '',
        sigla: conta.sigla ?? '',
        tipo: conta.tipo ?? 'servicos',
        cidade: conta.cidade ?? '',
        desde: conta.desde ?? new Date().toISOString().slice(0, 10),
        resumo: conta.resumo ?? '',
        setor_descricao: conta.setor_descricao ?? '',
        publico_alvo: conta.publico_alvo ?? '',
        tom_de_voz: conta.tom_de_voz ?? '',
        produtos_servicos: conta.produtos_servicos ?? '',
        posicionamento: conta.posicionamento ?? '',
        diferenciais: conta.diferenciais ?? '',
        concorrencia: conta.concorrencia ?? '',
        palavras_chave: conta.palavras_chave ?? '',
        contato_nome: conta.contato_nome ?? '',
        contato_cargo: conta.contato_cargo ?? '',
        contato_email: conta.contato_email ?? '',
        contato_telefone: conta.contato_telefone ?? '',
      });
      setMais(true);
    } else {
      setDados(VAZIO);
      setMais(false);
    }
  }, [aberto, conta]);

  const set = (campo: keyof ContaDados, valor: string) =>
    setDados((d) => ({ ...d, [campo]: valor }));

  const enviar = () => {
    if (!dados.nome.trim()) return;
    salvar.mutate(
      { conta, dados, existentes },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{conta ? 'Editar conta' : 'Nova conta'}</DialogTitle>
          <DialogDescription>
            {conta
              ? 'Atualize as informações desta conta da carteira.'
              : 'Cadastre uma nova conta da carteira da agência.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="conta-nome">Nome *</Label>
              <Input
                id="conta-nome"
                value={dados.nome}
                onChange={(e) => set('nome', e.target.value)}
                placeholder="Nome da conta"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="conta-sigla">Sigla</Label>
              <Input
                id="conta-sigla"
                value={dados.sigla}
                onChange={(e) => set('sigla', e.target.value)}
                placeholder="Ex.: ABC"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={dados.tipo} onValueChange={(v) => set('tipo', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="conta-cidade">Cidade</Label>
              <Input
                id="conta-cidade"
                value={dados.cidade}
                onChange={(e) => set('cidade', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="conta-desde">Cliente desde</Label>
              <Input
                id="conta-desde"
                type="date"
                value={dados.desde}
                onChange={(e) => set('desde', e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="conta-resumo">Resumo</Label>
            <Textarea
              id="conta-resumo"
              rows={3}
              value={dados.resumo}
              onChange={(e) => set('resumo', e.target.value)}
              placeholder="Uma frase sobre quem é o cliente."
            />
          </div>

          <button
            type="button"
            onClick={() => setMais((m) => !m)}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {mais ? 'Ocultar ficha completa' : 'Preencher ficha completa'}
          </button>

          {mais && (
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="conta-setor">Setor</Label>
                  <Input
                    id="conta-setor"
                    value={dados.setor_descricao}
                    onChange={(e) => set('setor_descricao', e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="conta-publico">Público-alvo</Label>
                  <Input
                    id="conta-publico"
                    value={dados.publico_alvo}
                    onChange={(e) => set('publico_alvo', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="conta-tom">Tom de voz</Label>
                <Input
                  id="conta-tom"
                  value={dados.tom_de_voz}
                  onChange={(e) => set('tom_de_voz', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="conta-produtos">Produtos e serviços</Label>
                <Textarea
                  id="conta-produtos"
                  rows={2}
                  value={dados.produtos_servicos}
                  onChange={(e) => set('produtos_servicos', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="conta-posicionamento">Posicionamento</Label>
                <Textarea
                  id="conta-posicionamento"
                  rows={2}
                  value={dados.posicionamento}
                  onChange={(e) => set('posicionamento', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="conta-diferenciais">Diferenciais</Label>
                <Textarea
                  id="conta-diferenciais"
                  rows={2}
                  value={dados.diferenciais}
                  onChange={(e) => set('diferenciais', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="conta-concorrencia">Concorrência</Label>
                <Textarea
                  id="conta-concorrencia"
                  rows={2}
                  value={dados.concorrencia}
                  onChange={(e) => set('concorrencia', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="conta-palavras">Palavras-chave</Label>
                <Input
                  id="conta-palavras"
                  value={dados.palavras_chave}
                  onChange={(e) => set('palavras_chave', e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="conta-contato-nome">Nome do contato</Label>
                  <Input
                    id="conta-contato-nome"
                    value={dados.contato_nome}
                    onChange={(e) => set('contato_nome', e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="conta-contato-cargo">Cargo do contato</Label>
                  <Input
                    id="conta-contato-cargo"
                    value={dados.contato_cargo}
                    onChange={(e) => set('contato_cargo', e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="conta-contato-email">E-mail do contato</Label>
                  <Input
                    id="conta-contato-email"
                    type="email"
                    value={dados.contato_email}
                    onChange={(e) => set('contato_email', e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="conta-contato-telefone">Telefone do contato</Label>
                  <Input
                    id="conta-contato-telefone"
                    value={dados.contato_telefone}
                    onChange={(e) => set('contato_telefone', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
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
