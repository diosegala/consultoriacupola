import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Doc {
  id: string;
  titulo: string;
  categoria: string | null;
  created_at: string;
}

export default function OraculoBase() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [categoria, setCategoria] = useState("metodo_cupola");

  if (!isAdmin) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const docsQuery = useQuery({
    queryKey: ["oraculo-knowledge"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oraculo_knowledge")
        .select("id, titulo, categoria, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Doc[];
    },
  });

  const indexar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("indexar-conhecimento", {
        body: { titulo, conteudo, categoria },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success("Documento indexado");
      setOpen(false);
      setTitulo(""); setConteudo(""); setCategoria("metodo_cupola");
      qc.invalidateQueries({ queryKey: ["oraculo-knowledge"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao indexar"),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("oraculo_knowledge").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento removido");
      qc.invalidateQueries({ queryKey: ["oraculo-knowledge"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao excluir"),
  });

  const total = docsQuery.data?.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Base de Conhecimento do Oráculo
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} documento{total === 1 ? "" : "s"} indexado{total === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/oraculo")}>Voltar ao chat</Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar documento
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Documentos</CardTitle></CardHeader>
        <CardContent>
          {docsQuery.isLoading ? (
            <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : total === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum documento ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docsQuery.data!.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.titulo}</TableCell>
                    <TableCell>
                      {d.categoria ? <Badge variant="secondary">{d.categoria}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(d.created_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => {
                        if (confirm(`Excluir "${d.titulo}"?`)) excluir.mutate(d.id);
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Adicionar documento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Pilar 1 - Diagnóstico" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="metodo_cupola, produto, processo, faq..." />
            </div>
            <div>
              <Label>Conteúdo</Label>
              <Textarea
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                rows={12}
                placeholder="Cole o conteúdo do documento aqui..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Para documentos longos, divida em trechos menores (500-1500 caracteres) e indexe um por vez.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => indexar.mutate()} disabled={!titulo.trim() || !conteudo.trim() || indexar.isPending}>
              {indexar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Indexar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}