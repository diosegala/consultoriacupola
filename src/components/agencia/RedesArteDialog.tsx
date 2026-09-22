import { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { Download, History, ImagePlus, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Slider, Textarea,
} from '@/design-system/design-system-hub-ba3841';
import { supabase } from '@/integrations/supabase/client';
import {
  aprovarImagem, assinarArte, gerarImagemArte, type FormatoArte, type RedesArte,
  useArtesTema, useIdentidadeVisual, useSalvarArte, useSalvarIdentidade,
} from '@/hooks/agencia/useAgenciaArtes';
import type { RedesTema } from '@/hooks/agencia/useAgenciaRedes';

const FORMATOS: Record<FormatoArte, { rotulo: string; largura: number; altura: number; classe: string }> = {
  feed_4_5: { rotulo: 'Feed 4:5', largura: 1080, altura: 1350, classe: 'aspect-[4/5]' },
  quadrado_1_1: { rotulo: 'Quadrado 1:1', largura: 1080, altura: 1080, classe: 'aspect-square' },
  stories_9_16: { rotulo: 'Stories 9:16', largura: 1080, altura: 1920, classe: 'aspect-[9/16]' },
};

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

async function carregarImagem(url: string) {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Não foi possível abrir a imagem aprovada.'));
    image.src = url;
  });
  return image;
}

function quebrarTexto(context: CanvasRenderingContext2D, texto: string, maximo: number) {
  const linhas: string[] = [];
  for (const paragrafo of texto.split('\n')) {
    let linha = '';
    for (const palavra of paragrafo.split(' ')) {
      const teste = `${linha} ${palavra}`.trim();
      if (context.measureText(teste).width > maximo && linha) {
        linhas.push(linha);
        linha = palavra;
      } else linha = teste;
    }
    if (linha) linhas.push(linha);
  }
  return linhas;
}

async function compor(url: string, texto: string, formato: FormatoArte, zoom: number, x: number, y: number, alinhamento: 'esquerda' | 'centro', cor: string) {
  const { largura, altura } = FORMATOS[formato];
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('O navegador não conseguiu montar a arte.');
  const image = await carregarImagem(url);
  const escala = Math.max(largura / image.width, altura / image.height) * zoom;
  const w = image.width * escala;
  const h = image.height * escala;
  context.drawImage(image, (largura - w) / 2 + x * largura / 200, (altura - h) / 2 + y * altura / 200, w, h);
  const margem = largura * 0.09;
  const tamanho = Math.round(largura * 0.066);
  context.font = `700 ${tamanho}px Manrope, sans-serif`;
  context.textAlign = alinhamento === 'centro' ? 'center' : 'left';
  context.textBaseline = 'middle';
  const linhas = quebrarTexto(context, texto, largura - margem * 2);
  const alturaLinha = tamanho * 1.18;
  const bloco = linhas.length * alturaLinha;
  const centroX = alinhamento === 'centro' ? largura / 2 : margem;
  const inicioY = altura * 0.68 - bloco / 2;
  context.fillStyle = 'rgba(0,0,0,0.68)';
  context.fillRect(0, inicioY - margem, largura, bloco + margem * 2);
  context.fillStyle = cor;
  linhas.forEach((linha, indice) => context.fillText(linha, centroX, inicioY + indice * alturaLinha));
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível exportar a arte.')), 'image/png'));
}

export function RedesArteDialog({ tema, clienteId, mes, open, onOpenChange }: { tema: RedesTema; clienteId: string; mes: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: identidade } = useIdentidadeVisual(clienteId);
  const { data: artes, refetch } = useArtesTema(tema.id);
  const salvarArte = useSalvarArte();
  const salvarIdentidade = useSalvarIdentidade(clienteId);
  const [formato, setFormato] = useState<FormatoArte>('feed_4_5');
  const [instrucao, setInstrucao] = useState('');
  const [imagem, setImagem] = useState('');
  const [imagemFinal, setImagemFinal] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [aprovada, setAprovada] = useState<RedesArte | null>(null);
  const [urlAprovada, setUrlAprovada] = useState('');
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [alinhamento, setAlinhamento] = useState<'esquerda' | 'centro'>('esquerda');
  const [slide, setSlide] = useState(0);
  const [textos, setTextos] = useState<string[]>([]);
  const [cores, setCores] = useState('');
  const [fontes, setFontes] = useState('');
  const [guia, setGuia] = useState('');
  const [salvando, setSalvando] = useState(false);
  const previaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const base = tema.formato === 'carrossel' && tema.slides?.length ? tema.slides.map((item) => item.texto) : [tema.texto_imagem ?? tema.titulo];
    setTextos(base);
  }, [tema]);
  useEffect(() => {
    setCores((identidade?.cores ?? []).join(', '));
    setFontes((identidade?.tipografia ?? []).join(', '));
    setGuia(identidade?.guia ?? '');
  }, [identidade]);
  useEffect(() => {
    const escolhida = artes?.find((arte) => arte.tipo === 'imagem_opcao' && arte.aprovada);
    if (!escolhida) return;
    setAprovada(escolhida);
    assinarArte(escolhida.caminho).then(setUrlAprovada).catch(() => undefined);
  }, [artes]);

  const incompleta = !cores.trim() || !fontes.trim() || !guia.trim() || !identidade?.logos.length;
  const corTexto = useMemo(() => {
    const primeira = cores.split(',').map((item) => item.trim()).find((item) => /^#[0-9a-f]{6}$/i.test(item));
    return primeira ?? '#ffffff';
  }, [cores]);

  const gerar = async () => {
    setGerando(true);
    setImagem('');
    setImagemFinal(false);
    try {
      let final = '';
      await gerarImagemArte({ clienteId, mes, temaId: tema.id, formato, instrucoes: instrucao, onFrame: (url, isFinal) => {
        setImagem(url);
        setImagemFinal(isFinal);
        if (isFinal) final = url;
      } });
      if (!final) throw new Error('A IA não devolveu a imagem final.');
      await salvarArte({ temaId: tema.id, clienteId, formato, dataUrl: final, prompt: instrucao, tipo: 'imagem_opcao' });
      toast.success('Opção criada. Aprove para começar a diagramação.');
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar a imagem.');
    } finally { setGerando(false); }
  };

  const aprovar = async (arte?: RedesArte) => {
    try {
      const escolhida = arte ?? artes?.find((item) => item.tipo === 'imagem_opcao' && item.caminho);
      if (!escolhida) return;
      await aprovarImagem(tema.id, escolhida.id);
      setAprovada({ ...escolhida, aprovada: true });
      setUrlAprovada(await assinarArte(escolhida.caminho));
      await refetch();
      toast.success('Imagem aprovada para a arte.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível aprovar.'); }
  };

  const exportar = async (salvar = false) => {
    if (!aprovada || !urlAprovada) return;
    setSalvando(true);
    try {
      const arquivos = await Promise.all(textos.map((texto) => compor(urlAprovada, texto, formato, zoom, x, y, alinhamento, corTexto)));
      if (salvar) {
        for (let indice = 0; indice < arquivos.length; indice += 1) {
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.readAsDataURL(arquivos[indice]);
          });
          await salvarArte({ temaId: tema.id, clienteId, formato, dataUrl, prompt: aprovada.prompt, tipo: 'arte_final', texto: textos[indice], slideIndice: indice, aprovada: true, composicao: { zoom, x, y, alinhamento } });
        }
        toast.success('Versão salva no histórico.');
      } else if (arquivos.length === 1) {
        baixar(arquivos[0], `${tema.titulo}-${FORMATOS[formato].rotulo}.png`);
      } else {
        const zip = new JSZip();
        arquivos.forEach((arquivo, indice) => zip.file(`${String(indice + 1).padStart(2, '0')}.png`, arquivo));
        baixar(await zip.generateAsync({ type: 'blob' }), `${tema.titulo}-${FORMATOS[formato].rotulo}.zip`);
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível montar a arte.'); }
    finally { setSalvando(false); }
  };

  const opcoes = artes?.filter((arte) => arte.tipo === 'imagem_opcao') ?? [];
  const finais = artes?.filter((arte) => arte.tipo === 'arte_final') ?? [];
  const textoAtual = textos[slide] ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar arte</DialogTitle>
          <DialogDescription>{tema.titulo}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-2">
          <section className="space-y-3">
            <div className="flex items-center justify-between"><h3 className="font-medium">Identidade visual</h3>{incompleta && <span className="text-xs text-warning">Cadastro incompleto</span>}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Cores em hexadecimal</Label><Input value={cores} onChange={(event) => setCores(event.target.value)} placeholder="#FFFFFF, #000000" /></div>
              <div><Label>Fontes</Label><Input value={fontes} onChange={(event) => setFontes(event.target.value)} placeholder="Manrope, Inter" /></div>
            </div>
            <div><Label>Orientações visuais</Label><Textarea value={guia} onChange={(event) => setGuia(event.target.value)} placeholder="Estilo fotográfico, elementos permitidos e proibidos." /></div>
            <Button variant="outline" onClick={async () => { try { await salvarIdentidade({ cores: cores.split(',').map((item) => item.trim()).filter(Boolean), tipografia: fontes.split(',').map((item) => item.trim()).filter(Boolean), guia }); toast.success('Identidade visual salva.'); } catch { toast.error('Não foi possível salvar a identidade.'); } }}>Salvar identidade</Button>
          </section>
          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="font-medium">1. Gerar e aprovar imagem</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select value={formato} onValueChange={(value) => setFormato(value as FormatoArte)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(FORMATOS).map(([id, item]) => <SelectItem key={id} value={id}>{item.rotulo}</SelectItem>)}</SelectContent></Select>
              <Input value={instrucao} onChange={(event) => setInstrucao(event.target.value)} placeholder="Direção visual opcional" />
            </div>
            <Button onClick={gerar} disabled={gerando}><Sparkles />{gerando ? 'Gerando imagem…' : 'Gerar nova opção'}</Button>
            {imagem && <div className="overflow-hidden rounded-md border border-border bg-muted"><img src={imagem} alt="Prévia gerada" className={`w-full object-cover transition ${imagemFinal ? '' : 'blur-md'}`} /></div>}
            {opcoes.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{opcoes.map((arte) => <OpcaoImagem key={arte.id} arte={arte} onApprove={() => aprovar(arte)} />)}</div>}
          </section>
          {aprovada && urlAprovada && <section className="space-y-4 border-t border-border pt-4">
            <h3 className="font-medium">2. Diagramar</h3>
            {textos.length > 1 && <Select value={String(slide)} onValueChange={(value) => setSlide(Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{textos.map((_, indice) => <SelectItem key={indice} value={String(indice)}>Slide {indice + 1}</SelectItem>)}</SelectContent></Select>}
            <Textarea value={textoAtual} onChange={(event) => setTextos((atuais) => atuais.map((item, indice) => indice === slide ? event.target.value : item))} />
            <div className="grid gap-4 sm:grid-cols-2"><div><Label>Enquadramento</Label><Slider min={1} max={2} step={0.05} value={[zoom]} onValueChange={([value]) => setZoom(value)} /></div><div><Label>Posição horizontal</Label><Slider min={-100} max={100} value={[x]} onValueChange={([value]) => setX(value)} /></div><div><Label>Posição vertical</Label><Slider min={-100} max={100} value={[y]} onValueChange={([value]) => setY(value)} /></div><div><Label>Alinhamento</Label><Select value={alinhamento} onValueChange={(value) => setAlinhamento(value as 'esquerda' | 'centro')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="esquerda">À esquerda</SelectItem><SelectItem value="centro">Centralizado</SelectItem></SelectContent></Select></div></div>
            <div ref={previaRef} className={`relative mx-auto w-full max-w-md overflow-hidden rounded-md border border-border bg-muted ${FORMATOS[formato].classe}`}><img src={urlAprovada} alt="Arte em edição" className="absolute h-full w-full object-cover" style={{ transform: `translate(${x / 2}%, ${y / 2}%) scale(${zoom})` }} /><div className="absolute inset-x-0 top-2/3 bg-background/80 p-6"><p className={`text-xl font-bold text-foreground ${alinhamento === 'centro' ? 'text-center' : 'text-left'}`}>{textoAtual}</p></div></div>
            <div className="flex flex-wrap gap-2"><Button onClick={() => exportar(true)} disabled={salvando}><Save />Salvar versão</Button><Button variant="outline" onClick={() => exportar(false)} disabled={salvando}><Download />{textos.length > 1 ? 'Baixar carrossel ZIP' : 'Baixar PNG'}</Button></div>
          </section>}
          {finais.length > 0 && <section className="space-y-2 border-t border-border pt-4"><h3 className="flex items-center gap-2 font-medium"><History />Histórico</h3><p className="text-sm text-muted-foreground">{finais.length} arquivo(s) final(is) salvo(s), da versão {finais[0].versao}.</p></section>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OpcaoImagem({ arte, onApprove }: { arte: RedesArte; onApprove: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => { assinarArte(arte.caminho).then(setUrl).catch(() => undefined); }, [arte.caminho]);
  return <div className="space-y-2">{url ? <img src={url} alt={`Opção ${arte.versao}`} className="aspect-square w-full rounded-md object-cover" /> : <div className="aspect-square animate-pulse rounded-md bg-muted" />}<Button variant={arte.aprovada ? 'secondary' : 'outline'} onClick={onApprove}><ImagePlus />{arte.aprovada ? 'Aprovada' : 'Aprovar'}</Button></div>;
}