import { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

// Dados mockados para demonstração
const mockConsultores = [
  { id: '1', nome: 'Janile', email: 'janile@cupola.com.br', ativo: true, clientesAtivos: 5, mrrGestao: 52000 },
  { id: '2', nome: 'Cristiano', email: 'cristiano@cupola.com.br', ativo: true, clientesAtivos: 4, mrrGestao: 38000 },
  { id: '3', nome: 'Dioner', email: 'dioner@cupola.com.br', ativo: true, clientesAtivos: 4, mrrGestao: 35000 },
  { id: '4', nome: 'Vivian', email: 'vivian@cupola.com.br', ativo: true, clientesAtivos: 3, mrrGestao: 28000 },
  { id: '5', nome: 'Alice', email: 'alice@cupola.com.br', ativo: true, clientesAtivos: 3, mrrGestao: 25000 },
  { id: '6', nome: 'Renata', email: 'renata@cupola.com.br', ativo: true, clientesAtivos: 3, mrrGestao: 30000 },
  { id: '7', nome: 'Denise', email: 'denise@cupola.com.br', ativo: true, clientesAtivos: 3, mrrGestao: 32000 },
  { id: '8', nome: 'Natalia', email: 'natalia@cupola.com.br', ativo: true, clientesAtivos: 2, mrrGestao: 25000 },
  { id: '9', nome: 'Emillyn', email: 'emillyn@cupola.com.br', ativo: true, clientesAtivos: 1, mrrGestao: 20000 },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
  }).format(value);
};

export default function Consultores() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Consultores</h1>
          <p className="text-muted-foreground">Gerencie a equipe de consultores</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Novo Consultor
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">
            {mockConsultores.length} consultor{mockConsultores.length !== 1 ? 'es' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Nome</TableHead>
                <TableHead className="text-muted-foreground">Email</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground text-center">Clientes Ativos</TableHead>
                <TableHead className="text-muted-foreground">MRR sob Gestão</TableHead>
                <TableHead className="text-muted-foreground text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockConsultores.map((consultor) => (
                <TableRow key={consultor.id} className="border-border">
                  <TableCell className="font-medium text-foreground">{consultor.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{consultor.email}</TableCell>
                  <TableCell>
                    <Badge 
                      className={consultor.ativo 
                        ? 'bg-success text-success-foreground' 
                        : 'bg-muted text-muted-foreground'
                      }
                    >
                      {consultor.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-foreground">{consultor.clientesAtivos}</TableCell>
                  <TableCell className="text-foreground">{formatCurrency(consultor.mrrGestao)}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
