import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import type { Pergunta } from '@/lib/questionario';

export function CampoPergunta({
  pergunta,
  valor,
  onChange,
}: {
  pergunta: Pergunta;
  valor: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `q-${pergunta.id}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {pergunta.label}
        {pergunta.obrigatorio && <span className="text-destructive ml-1">*</span>}
      </Label>
      {pergunta.dica && <p className="text-xs text-muted-foreground">{pergunta.dica}</p>}
      {renderInput(pergunta, valor, onChange, id)}
    </div>
  );
}

function renderInput(
  p: Pergunta,
  valor: unknown,
  onChange: (v: unknown) => void,
  id: string,
) {
  switch (p.tipo) {
    case 'texto_curto':
      return <Input id={id} value={(valor as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'texto_longo':
      return <Textarea id={id} rows={4} value={(valor as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'numero':
      return (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="number"
            value={(valor as string | number | undefined) ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          />
          {p.sufixo && <span className="text-sm text-muted-foreground">{p.sufixo}</span>}
        </div>
      );
    case 'data':
      return <Input id={id} type="date" value={(valor as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'sim_nao':
      return (
        <RadioGroup value={(valor as string) ?? ''} onValueChange={onChange} className="flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <RadioGroupItem value="sim" /> Sim
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <RadioGroupItem value="nao" /> Não
          </label>
        </RadioGroup>
      );
    case 'escolha_unica':
      return (
        <RadioGroup value={(valor as string) ?? ''} onValueChange={onChange} className="space-y-2">
          {p.opcoes?.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value={o} /> {o}
            </label>
          ))}
        </RadioGroup>
      );
    case 'escolha_multipla': {
      const arr = Array.isArray(valor) ? (valor as string[]) : [];
      return (
        <div className="space-y-2">
          {p.opcoes?.map((o) => {
            const checked = arr.includes(o);
            return (
              <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => {
                    const next = c ? [...arr, o] : arr.filter((x) => x !== o);
                    onChange(next);
                  }}
                />
                {o}
              </label>
            );
          })}
        </div>
      );
    }
    case 'escala_1_10':
      return (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const ativo = valor === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`h-9 w-9 rounded-md border text-sm font-medium transition-colors ${
                  ativo
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-foreground hover:bg-muted'
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      );
    default:
      return <Input id={id} value={(valor as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
}