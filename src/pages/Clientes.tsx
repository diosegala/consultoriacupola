import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { StatusCliente } from '@/types/database';

// Dados mockados para demonstração
const mockClientes = [
  { id: '1', nome: 'Imobiliária Alpha', cidade: 'São Paulo', uf: 'SP', consultor: 'Janile', tipo: 'Consultoria Padrão', mrr: 12000, status: 'ativo' as StatusCliente, dataFim: '2026-06-15' },
  { id: '2', nome: 'Imóveis Beta', cidade: 'Curitiba', uf: 'PR', consultor: 'Cristiano', tipo: 'Consultoria de Vendas', mrr: 8500, status: 'ativo' as StatusCliente, dataFim: '2026-03-20' },
  { id: '3', nome: 'Nova Imob', cidade: 'Florianópolis', uf: 'SC', consultor: null, tipo: null, mrr: 0, status: 'novo' as StatusCliente, dataFim: null },
  { id: '4', nome: 'Casa & Lar', cidade: 'Porto Alegre', uf: 'RS', consultor: 'Dioner', tipo: 'Consultoria Start Vendas', mrr: 6000, status: 'aguardando_renovacao' as StatusCliente, dataFim: '2026-02-10' },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
  }).format(value);
};

const formatDate = (date: string | null) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('pt-BR');
};

export default function Clientes() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredClientes = mockClientes.filter((cliente) => {
    const matchesSearch = cliente.nome.toLowerCase().includes(search.toLowerCase()) ||
      cliente.cidade.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || cliente.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">Gerencie sua carteira de clientes</p>
        </div>
        <Button 
          onClick={() => navigate('/clientes/novo')}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      {/* Filtros */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou cidade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-input border-border"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-input border-border">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="aguardando_renovacao">Aguardando Renovação</SelectItem>
                <SelectItem value="encerrado">Encerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">
            {filteredClientes.length} cliente{filteredClientes.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Nome</TableHead>
                <TableHead className="text-muted-foreground">Cidade/UF</TableHead>
                <TableHead className="text-muted-foreground">Consultor</TableHead>
                <TableHead className="text-muted-foreground">Tipo</TableHead>
                <TableHead className="text-muted-foreground">MRR</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Data Fim</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClientes.map((cliente) => (
                <TableRow 
                  key={cliente.id} 
                  className="border-border cursor-pointer hover:bg-secondary/50"
                  onClick={() => navigate(`/clientes/${cliente.id}`)}
                >
                  <TableCell className="font-medium text-foreground">{cliente.nome}</TableCell>
                  <TableCell className="text-foreground">{cliente.cidade}/{cliente.uf}</TableCell>
                  <TableCell className="text-foreground">{cliente.consultor || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{cliente.tipo || '-'}</TableCell>
                  <TableCell className="text-foreground">
                    {cliente.mrr > 0 ? formatCurrency(cliente.mrr) : '-'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={cliente.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(cliente.dataFim)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredClientes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum cliente encontrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
