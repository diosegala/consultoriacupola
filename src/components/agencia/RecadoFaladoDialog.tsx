import { useRef, useState } from 'react';
import { Loader2, Mic, Square, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const TETO = 14 * 1024 * 1024;

async function paraBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  return btoa(bin);
}

interface Props {
  clienteId: string;
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
}

export function RecadoFaladoDialog({ clienteId, aberto, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [gravando, setGravando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [registro, setRegistro] = useState<{ titulo: string; texto: string } | null>(null);
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const pedacosRef = useRef<Blob[]>([]);

  const enviar = async (blob: Blob, mime: string) => {
    if (blob.size > TETO) {
      toast({
        title: 'Áudio muito longo',
        description: 'O limite de uma escuta é 14 MB. Grave em pedaços.',
        variant: 'destructive',
      });
      return;
    }
    setEnviando(true);
    setRegistro(null);
    try {
      const base64 = await paraBase64(blob);
      const { data, error } = await supabase.functions.invoke('agencia-audio', {
        body: { cliente_id: clienteId, mime, base64 },
      });
      if (error) throw error;
      const r = data as { error?: string; vazio?: boolean; titulo?: string; texto?: string };
      if (r.error) throw new Error(r.error);
      if (r.vazio) {
        toast({ title: 'Não achei nada de aproveitável nesse áudio', description: 'Tente falar de novo, com mais detalhe.' });
        return;
      }
      setRegistro({ titulo: r.titulo ?? '', texto: r.texto ?? '' });
      qc.invalidateQueries({ queryKey: ['agencia', 'conhecimento', clienteId] });
      toast({ title: 'Registro guardado no material da conta' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro inesperado.';
      toast({ title: 'Não deu para transformar o áudio em texto', description: msg, variant: 'destructive' });
    } finally {
      setEnviando(false);
    }
  };

  const comecar = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const gravador = new MediaRecorder(stream);
      pedacosRef.current = [];
      gravador.ondataavailable = (e) => e.data.size && pedacosRef.current.push(e.data);
      gravador.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = gravador.mimeType || 'audio/webm';
        await enviar(new Blob(pedacosRef.current, { type: mime }), mime);
      };
      gravador.start();
      gravadorRef.current = gravador;
      setGravando(true);
    } catch {
      toast({
        title: 'Não consegui usar o microfone',
        description: 'Autorize o microfone no navegador e tente de novo.',
        variant: 'destructive',
      });
    }
  };

  const parar = () => {
    gravadorRef.current?.stop();
    gravadorRef.current = null;
    setGravando(false);
  };

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Recado falado</DialogTitle>
          <DialogDescription>
            Fale o que ficou da reunião ou da ligação. O texto entra no material da conta e o áudio não fica guardado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {gravando ? (
              <Button variant="destructive" onClick={parar}>
                <Square className="mr-2 h-4 w-4" />
                Parar e enviar
              </Button>
            ) : (
              <Button onClick={comecar} disabled={enviando}>
                <Mic className="mr-2 h-4 w-4" />
                Gravar
              </Button>
            )}
            <label className="inline-flex">
              <Input
                type="file"
                accept="audio/*"
                className="hidden"
                disabled={enviando || gravando}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) enviar(f, f.type || 'audio/mp3');
                  e.target.value = '';
                }}
              />
              <Button variant="outline" asChild disabled={enviando || gravando}>
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Enviar um arquivo
                </span>
              </Button>
            </label>
            {enviando && (
              <span className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ouvindo e organizando…
              </span>
            )}
          </div>

          {registro && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{registro.titulo}</p>
              <Textarea value={registro.texto} readOnly rows={14} />
              <p className="text-xs text-muted-foreground">
                Já está salvo no material da conta, na aba Conhecimento.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
