import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Users, DollarSign, Star, Video, FileDown } from 'lucide-react';

import { useConsultoresComStats } from '@/hooks/useConsultores';
import { useReunioesByConsultor, useScoreConsultor } from '@/hooks/useReunioes';
import { ReunioesList } from '@/components/consultor/ReunioesList';
import { DiscProfileCard } from '@/components/disc/DiscProfileCard';
import { DiscCruzamentoCard } from '@/components/disc/DiscCruzamentoCard';
import { useAuth } from '@/contexts/AuthContext';
import { useMyConsultorId } from '@/hooks/useDisc';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ConsultorDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: consultores, isLoading: loadingConsultor } = useConsultoresComStats();
  const { data: reunioes, isLoading: loadingReunioes } = useReunioesByConsultor(id);
  const { data: scoreData } = useScoreConsultor(id);
  const { isAdmin, isDirector } = useAuth();
  const { data: myConsultorId } = useMyConsultorId();

  const consultor = consultores?.find(c => c.id === id);

  if (loadingConsultor) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!consultor) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        Consultor não encontrado
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/consultores')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{consultor.nome}</h1>
            <Badge className={consultor.ativo ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}>
              {consultor.ativo ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          {consultor.email && <p className="text-muted-foreground">{consultor.email}</p>}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clientes Ativos</p>
                <p className="text-2xl font-bold text-foreground">{consultor.clientes_ativos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">MRR sob Gestão</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(consultor.mrr_sob_gestao)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Score Médio</p>
                <p className="text-2xl font-bold text-foreground">
                  {scoreData ? scoreData.score_medio.toFixed(1) : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reuniões Analisadas</p>
                <p className="text-2xl font-bold text-foreground">{scoreData?.total_reunioes || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reuniões */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Reuniões deste consultor</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Visão consolidada. Para adicionar ou re-analisar uma reunião, acesse a ficha do cliente.
            </p>
          </div>
          <div className="flex gap-2">
            {reunioes?.some(r => r.status_analise === 'concluido') && (
              <Button
                variant="outline"
                onClick={() => navigate(`/consultores/${id}/relatorio`)}
              >
                <FileDown className="h-4 w-4 mr-2" /> Gerar Relatório
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ReunioesList reunioes={reunioes} isLoading={loadingReunioes} linkCliente />
        </CardContent>
      </Card>

      {(isAdmin || isDirector) && id && (
        <>
          <DiscProfileCard consultor_id={id} canEdit />
          {myConsultorId && myConsultorId !== id && (
            <DiscCruzamentoCard
              diretor_id={myConsultorId}
              consultor_id={id}
              consultor_nome={consultor.nome}
            />
          )}
        </>
      )}
    </div>
  );
}
