import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

// Dados mockados para demonstração
const mockTiposConsultoria = [
  { id: '1', nome: 'Consultoria Padrão', ativo: true },
  { id: '2', nome: 'Consultoria de Vendas', ativo: true },
  { id: '3', nome: 'Consultoria de Locação', ativo: true },
  { id: '4', nome: 'Consultoria Start Vendas', ativo: true },
  { id: '5', nome: 'Consultoria Start Locação', ativo: true },
  { id: '6', nome: 'Assessoria de Funil de Vendas', ativo: true },
  { id: '7', nome: 'Diagnóstico de Vendas', ativo: true },
  { id: '8', nome: 'Diagnóstico de Locação', ativo: true },
  { id: '9', nome: 'Diagnóstico de Funil', ativo: true },
  { id: '10', nome: 'Mapeamento de Performance e Oportunidades', ativo: true },
  { id: '11', nome: 'Personalizado', ativo: true },
];

const mockCRMs = [
  { id: '1', nome: 'Imoview', ativo: true },
  { id: '2', nome: 'Vista', ativo: true },
  { id: '3', nome: 'InGaia', ativo: true },
  { id: '4', nome: 'Kenlo', ativo: true },
  { id: '5', nome: 'Flexpro', ativo: true },
  { id: '6', nome: 'C2S', ativo: true },
  { id: '7', nome: 'Outro', ativo: true },
  { id: '8', nome: 'Não possui', ativo: true },
];

export default function Configuracoes() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Gerencie os cadastros auxiliares do sistema</p>
      </div>

      <Tabs defaultValue="tipos" className="w-full">
        <TabsList className="bg-secondary">
          <TabsTrigger value="tipos">Tipos de Consultoria</TabsTrigger>
          <TabsTrigger value="crms">CRMs</TabsTrigger>
        </TabsList>

        <TabsContent value="tipos" className="mt-6">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-foreground">Tipos de Consultoria</CardTitle>
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Novo Tipo
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Nome</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockTiposConsultoria.map((tipo) => (
                    <TableRow key={tipo.id} className="border-border">
                      <TableCell className="font-medium text-foreground">{tipo.nome}</TableCell>
                      <TableCell>
                        <Badge 
                          className={tipo.ativo 
                            ? 'bg-success text-success-foreground' 
                            : 'bg-muted text-muted-foreground'
                          }
                        >
                          {tipo.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
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
        </TabsContent>

        <TabsContent value="crms" className="mt-6">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-foreground">CRMs</CardTitle>
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Novo CRM
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Nome</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockCRMs.map((crm) => (
                    <TableRow key={crm.id} className="border-border">
                      <TableCell className="font-medium text-foreground">{crm.nome}</TableCell>
                      <TableCell>
                        <Badge 
                          className={crm.ativo 
                            ? 'bg-success text-success-foreground' 
                            : 'bg-muted text-muted-foreground'
                          }
                        >
                          {crm.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
