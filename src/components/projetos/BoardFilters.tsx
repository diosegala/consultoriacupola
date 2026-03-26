import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
import { useProjetoTags, type ProjetoTag } from '@/hooks/useProjetoTags';

interface BoardFiltersProps {
  searchText: string;
  onSearchChange: (text: string) => void;
  filtroConsultor: string;
  onFiltroConsultorChange: (value: string) => void;
  filtroTag: string;
  onFiltroTagChange: (value: string) => void;
  consultores: Array<{ id: string; nome: string; ativo: boolean }> | undefined;
  isConsultor: boolean;
}

export function BoardFilters({
  searchText,
  onSearchChange,
  filtroConsultor,
  onFiltroConsultorChange,
  filtroTag,
  onFiltroTagChange,
  consultores,
  isConsultor,
}: BoardFiltersProps) {
  const { data: tags } = useProjetoTags();

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente..."
          value={searchText}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-9 w-[200px] h-9"
        />
      </div>

      {!isConsultor && (
        <Select value={filtroConsultor} onValueChange={onFiltroConsultorChange}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="Filtrar por consultor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os consultores</SelectItem>
            {consultores?.filter(c => c.ativo).map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={filtroTag} onValueChange={onFiltroTagChange}>
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Filtrar por tag" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as tags</SelectItem>
          {tags?.map(tag => (
            <SelectItem key={tag.id} value={tag.id}>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.cor }} />
                {tag.nome}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
