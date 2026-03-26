import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, Link as LinkIcon } from 'lucide-react';
import { useClientes } from '@/hooks/useClientes';
import { useCreateReuniao, useAnalisarReuniao } from '@/hooks/useReunioes';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface NovaReuniaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultorId: string;
  clienteId?: string;
}

export function NovaReuniaoDialog({ open, onOpenChange, consultorId, clienteId }: NovaReuniaoDialogProps) {
  const { toast } = useToast();
  const { data: clientes } = useClientes();
  const createReuniao = useCreateReuniao();
  const analisarReuniao = useAnalisarReuniao();

  const [transcricaoMode, setTranscricaoMode] = useState<'colar' | 'link'>('colar');
  const [linkTranscricao, setLinkTranscricao] = useState('');
  const [loadingLink, setLoadingLink] = useState(false);

  const [formData, setFormData] = useState({
    cliente_id: clienteId ?? '',
    data_reuniao: format(new Date(), 'yyyy-MM-dd'),
    duracao_minutos: '',
    google_meet_link: '',
    transcricao: '',
  });

  const stripHtml = (html: string): string => {
    // Remove script and style tags with content
    let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
    // Replace <br>, <p>, <div>, <li> with newlines
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n');
    // Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');
    // Decode HTML entities
    text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
    // Collapse multiple blank lines
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    return text;
  };

  const fetchTranscricaoFromLink = async () => {
    if (!linkTranscricao.trim()) {
      toast({ title: 'Erro', description: 'Insira o link do arquivo', variant: 'destructive' });
      return;
    }

    setLoadingLink(true);
    try {
      const response = await fetch(linkTranscricao.trim());
      if (!response.ok) throw new Error('Não foi possível acessar o arquivo');
      const rawText = await response.text();
      if (!rawText.trim()) throw new Error('O arquivo está vazio');
      // Strip HTML if content looks like HTML
      const isHtml = /<\s*(html|head|body|div|p|span)\b/i.test(rawText);
      const cleanText = isHtml ? stripHtml(rawText) : rawText;
      if (!cleanText.trim()) throw new Error('Não foi possível extrair texto do documento');
      setFormData(prev => ({ ...prev, transcricao: cleanText }));
      toast({ title: 'Transcrição importada', description: `${cleanText.length} caracteres carregados` });
    } catch (error: any) {
      toast({
        title: 'Erro ao importar',
        description: error.message || 'Verifique se o link é público e acessível',
        variant: 'destructive',
      });
    } finally {
      setLoadingLink(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.cliente_id || !formData.data_reuniao) {
      toast({ title: 'Erro', description: 'Cliente e data são obrigatórios', variant: 'destructive' });
      return;
    }
    if (!formData.transcricao.trim()) {
      toast({ title: 'Erro', description: 'A transcrição é obrigatória para análise', variant: 'destructive' });
      return;
    }

    try {
      const reuniao = await createReuniao.mutateAsync({
        consultor_id: consultorId,
        cliente_id: formData.cliente_id,
        data_reuniao: formData.data_reuniao,
        duracao_minutos: formData.duracao_minutos ? parseInt(formData.duracao_minutos) : null,
        google_meet_link: formData.google_meet_link || null,
        transcricao: formData.transcricao,
      });

      toast({ title: 'Reunião registrada', description: 'Iniciando análise por IA...' });
      onOpenChange(false);
      resetForm();

      analisarReuniao.mutate(reuniao.id, {
        onSuccess: () => {
          toast({ title: 'Análise concluída', description: 'A IA finalizou a análise da reunião' });
        },
        onError: (err: any) => {
          toast({ title: 'Erro na análise', description: err.message, variant: 'destructive' });
        },
      });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({
      cliente_id: '',
      data_reuniao: format(new Date(), 'yyyy-MM-dd'),
      duracao_minutos: '',
      google_meet_link: '',
      transcricao: '',
    });
    setLinkTranscricao('');
    setTranscricaoMode('colar');
  };

  const clientesAtivos = clientes?.filter(c => c.status === 'ativo') || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Nova Reunião</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Cliente *</Label>
              <Select value={formData.cliente_id} onValueChange={(v) => setFormData({ ...formData, cliente_id: v })}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientesAtivos.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Data *</Label>
              <Input
                type="date"
                value={formData.data_reuniao}
                onChange={(e) => setFormData({ ...formData, data_reuniao: e.target.value })}
                className="bg-input border-border"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Duração (min)</Label>
              <Input
                type="number"
                value={formData.duracao_minutos}
                onChange={(e) => setFormData({ ...formData, duracao_minutos: e.target.value })}
                placeholder="60"
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Link Google Meet</Label>
              <Input
                value={formData.google_meet_link}
                onChange={(e) => setFormData({ ...formData, google_meet_link: e.target.value })}
                placeholder="https://meet.google.com/..."
                className="bg-input border-border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Transcrição *</Label>
            <Tabs value={transcricaoMode} onValueChange={(v) => setTranscricaoMode(v as 'colar' | 'link')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="colar" className="gap-2">
                  <FileText className="h-4 w-4" /> Colar texto
                </TabsTrigger>
                <TabsTrigger value="link" className="gap-2">
                  <LinkIcon className="h-4 w-4" /> Importar via link
                </TabsTrigger>
              </TabsList>

              <TabsContent value="colar" className="mt-3">
                <Textarea
                  value={formData.transcricao}
                  onChange={(e) => setFormData({ ...formData, transcricao: e.target.value })}
                  placeholder="Cole aqui a transcrição da reunião do Google Meet..."
                  className="bg-input border-border min-h-[200px] font-mono text-sm"
                />
              </TabsContent>

              <TabsContent value="link" className="mt-3 space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={linkTranscricao}
                    onChange={(e) => setLinkTranscricao(e.target.value)}
                    placeholder="https://docs.google.com/... ou link direto para .txt"
                    className="bg-input border-border flex-1"
                  />
                  <Button
                    type="button"
                    onClick={fetchTranscricaoFromLink}
                    disabled={loadingLink}
                    variant="outline"
                    className="border-border"
                  >
                    {loadingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Importar'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Insira um link público para o arquivo de transcrição (.txt, Google Docs com compartilhamento público, etc.)
                </p>
                {formData.transcricao && (
                  <div className="rounded-md border border-border bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Prévia ({formData.transcricao.length} caracteres):</p>
                    <p className="text-sm text-foreground line-clamp-4 font-mono">{formData.transcricao}</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {transcricaoMode === 'colar' && (
              <p className="text-xs text-muted-foreground">
                Cole a transcrição gerada pelo Gemini no Google Meet. A análise por IA será feita automaticamente.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createReuniao.isPending}
            className="bg-primary text-primary-foreground"
          >
            {createReuniao.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar e Analisar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
