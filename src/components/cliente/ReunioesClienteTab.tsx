import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useReunioesByCliente } from '@/hooks/useReunioes';
import { ReunioesList } from '@/components/consultor/ReunioesList';
import { NovaReuniaoDialog } from '@/components/consultor/NovaReuniaoDialog';

interface Props {
  clienteId: string;
}

export function ReunioesClienteTab({ clienteId }: Props) {
  const { data: reunioes, isLoading } = useReunioesByCliente(clienteId);
  const [novaOpen, setNovaOpen] = useState(false);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-foreground">Reuniões</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Transcrições importadas automaticamente do Google Drive ou adicionadas manualmente.
          </p>
        </div>
        <Button onClick={() => setNovaOpen(true)} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Adicionar manualmente
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <ReunioesList
          reunioes={reunioes}
          isLoading={isLoading}
          hideClienteColumn
          showConsultorColumn
        />
      </CardContent>
      <NovaReuniaoDialog
        open={novaOpen}
        onOpenChange={setNovaOpen}
        clienteId={clienteId}
      />
    </Card>
  );
}