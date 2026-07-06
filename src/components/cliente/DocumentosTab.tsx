import { useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Link as LinkIcon, Upload, FileText, ExternalLink, Trash2, Loader2, Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';
import {
  useClienteArquivos,
  useAddClienteArquivoLink,
  useUploadClienteArquivo,
  useDeleteClienteArquivo,
  getClienteArquivoSignedUrl,
  type ClienteArquivo,
} from '@/hooks/useClienteArquivos';
import { useAuth } from '@/contexts/AuthContext';
import { useMyConsultorId } from '@/hooks/useConsultorUser';

const CATEGORIAS = [
  { value: 'contrato', label: 'Contrato' },
  { value: 'mercado', label: 'Mercado' },
  { value: 'concorrencia', label: 'Concorrência' },
  { value: 'material_cliente', label: 'Material do cliente' },
  { value: 'outro', label: 'Outro' },
];

function labelCategoria(v?: string | null) {
  return CATEGORIAS.find(c => c.value === v)?.label ?? v ?? '—';
}

export function DocumentosTab({ clienteId }: { clienteId: string }) {
  const { data: arquivos, isLoading } = useClienteArquivos(clienteId);
  const { isAdmin } = useAuth();
  const { data: myConsultorId } = useMyConsultorId();
  const addLink = useAddClienteArquivoLink();
  const upload = useUploadClienteArquivo();
  const remover = useDeleteClienteArquivo();

  const [addOpen, setAddOpen] = useState(false);
  const [modo, setModo] = useState<'link' | 'arquivo'>('link');
  const [titulo, setTitulo] = useState('');
  const [url, setUrl] = useState('');
  const [categoria, setCategoria] = useState<string>('outro');
  const [descricao, setDescricao] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');

  const filtrados = useMemo(() => {
    if (!arquivos) return [];
    if (filtroCategoria === 'todos') return arquivos;
    return arquivos.filter(a => (a.categoria ?? 'outro') === filtroCategoria);
  }, [arquivos, filtroCategoria]);

  const resetForm = () => {
    setTitulo(''); setUrl(''); setCategoria('outro'); setDescricao(''); setFile(null); setModo('link');
    if (fileRef.current) fileRef.current.value = '';
  };

  const submeter = async () => {
    if (!titulo.trim()) { toast.error('Informe um título'); return; }
    try {
      if (modo === 'link') {
        if (!url.trim()) { toast.error('Informe a URL'); return; }
        await addLink.mutateAsync({
          cliente_id: clienteId,
          titulo: titulo.trim(),
          url: url.trim(),
          categoria,
          descricao: descricao.trim() || null,
          adicionado_por: myConsultorId ?? null,
        });
      } else {
        if (!file) { toast.error('Selecione um arquivo'); return; }
        await upload.mutateAsync({
          cliente_id: clienteId,
          titulo: titulo.trim(),
          file,
          categoria,
          descricao: descricao.trim() || null,
          adicionado_por: myConsultorId ?? null,
        });
      }
      toast.success('Documento adicionado.');
      setAddOpen(false);
      resetForm();
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao adicionar.');
    }
  };

  const abrir = async (a: ClienteArquivo) => {
    try {
      const href = a.tipo === 'arquivo' ? await getClienteArquivoSignedUrl(a.url) : a.url;
      window.open(href, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao abrir o arquivo.');
    }
  };

  const podeRemover = (a: ClienteArquivo) =>
    isAdmin || (myConsultorId && a.adicionado_por === myConsultorId);

  const excluir = async (a: ClienteArquivo) => {
    if (!confirm(`Remover "${a.titulo}"?`)) return;
    try {
      await remover.mutateAsync(a);
      toast.success('Removido.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao remover.');
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-foreground">Documentos e Links</CardTitle>
          <p className="text-sm text-muted-foreground">
            Base de referência do cliente: contratos, materiais de mercado, links relevantes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-[180px] bg-input border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as categorias</SelectItem>
              {CATEGORIAS.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Nenhum documento nesta categoria. Clique em "Adicionar" para começar.
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map(a => (
              <div key={a.id} className="rounded-md border border-border bg-background p-3 flex items-start gap-3">
                <div className="text-muted-foreground mt-0.5">
                  {a.tipo === 'link' ? <LinkIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground truncate">{a.titulo}</span>
                    <Badge variant="outline" className="text-[10px]">{labelCategoria(a.categoria)}</Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {a.tipo === 'link' ? 'link' : 'arquivo'}
                    </Badge>
                  </div>
                  {a.descricao && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.descricao}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {a.adicionado?.nome ? `Adicionado por ${a.adicionado.nome}` : 'Adicionado'} •{' '}
                    {format(new Date(a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => abrir(a)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
                  </Button>
                  {podeRemover(a) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => excluir(a)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar documento</DialogTitle>
            <DialogDescription>Cole um link externo ou envie um arquivo (até 20 MB).</DialogDescription>
          </DialogHeader>
          <Tabs value={modo} onValueChange={(v) => setModo(v as 'link' | 'arquivo')}>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="link"><LinkIcon className="h-4 w-4 mr-1.5" /> Colar link</TabsTrigger>
              <TabsTrigger value="arquivo"><Upload className="h-4 w-4 mr-1.5" /> Enviar arquivo</TabsTrigger>
            </TabsList>
            <TabsContent value="link" className="space-y-3 pt-3">
              <Input placeholder="URL (https://...)" value={url} onChange={(e) => setUrl(e.target.value)} />
            </TabsContent>
            <TabsContent value="arquivo" className="space-y-3 pt-3">
              <Input
                ref={fileRef}
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f && !titulo) setTitulo(f.name);
                }}
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  {file.name} • {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              )}
            </TabsContent>
          </Tabs>

          <div className="space-y-3 pt-1">
            <div>
              <label className="text-xs text-muted-foreground">Título</label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Contrato assinado 2024" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Categoria</label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Descrição (opcional)</label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={submeter} disabled={addLink.isPending || upload.isPending}>
              {(addLink.isPending || upload.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}