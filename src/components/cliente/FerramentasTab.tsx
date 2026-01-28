import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, Check, X } from 'lucide-react';
import { useFerramentas, useCreateFerramentas } from '@/hooks/useFerramentas';
import { FerramentasFormDialog } from './ClienteDialogs';

interface FerramentasTabProps {
  clienteId: string;
}

export function FerramentasTab({ clienteId }: FerramentasTabProps) {
  const { data: ferramentas, isLoading } = useFerramentas(clienteId);
  const createFerramentas = useCreateFerramentas();
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async () => {
    await createFerramentas.mutateAsync({
      cliente_id: clienteId
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!ferramentas) {
    return (
      <Card className="bg-card border-border border-dashed">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">Nenhuma ferramenta configurada</p>
          <Button onClick={handleCreate} disabled={createFerramentas.isPending}>
            {createFerramentas.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Configurar Ferramentas
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">Ferramentas do Cliente</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            Editar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CRM */}
            <div>
              <p className="text-sm text-muted-foreground">CRM Utilizado</p>
              <p className="text-foreground font-medium">
                {ferramentas.crm?.nome || 'Não definido'}
              </p>
            </div>

            {/* ConectaLead */}
            <div>
              <p className="text-sm text-muted-foreground">ConectaLead</p>
              <div className="flex items-center gap-2 mt-1">
                {ferramentas.tem_conectalead ? (
                  <>
                    <Check className="h-4 w-4 text-primary" />
                    <span className="text-foreground">Ativo</span>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Não possui</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="mt-6 pt-6 border-t border-border space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Dashboard de Marketing</p>
              {ferramentas.link_dashboard_marketing ? (
                <a 
                  href={ferramentas.link_dashboard_marketing} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 mt-1"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir dashboard
                </a>
              ) : (
                <p className="text-muted-foreground">Não configurado</p>
              )}
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Investimento Digital</p>
              {ferramentas.link_investimento_digital ? (
                <a 
                  href={ferramentas.link_investimento_digital} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 mt-1"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir planilha
                </a>
              ) : (
                <p className="text-muted-foreground">Não configurado</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <FerramentasFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        ferramentas={ferramentas}
        clienteId={clienteId}
      />
    </div>
  );
}
