import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Maximize2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { OraculoChatPanel } from "./OraculoChatPanel";

export function OraculoFloatingChat() {
  const [open, setOpen] = useState(false);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const navigate = useNavigate();

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl z-50"
        aria-label="Abrir Oráculo"
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" /> Oráculo da Cupola
              </SheetTitle>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setConversaId(null); setResetKey((k) => k + 1); }} title="Nova conversa">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    navigate(conversaId ? `/oraculo?c=${conversaId}` : "/oraculo");
                  }}
                  title="Abrir em tela cheia"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <OraculoChatPanel
              key={resetKey}
              conversaId={conversaId}
              onConversaCriada={setConversaId}
              compact
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}