import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@/design-system/design-system-hub-ba3841';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  const label = isDark ? 'Ativar tema claro' : 'Ativar tema escuro';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={label}
        >
          {isDark ? <Sun /> : <Moon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}