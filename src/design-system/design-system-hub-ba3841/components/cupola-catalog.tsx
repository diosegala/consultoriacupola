import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  Code2,
  Copy,
  FileText,
  Grid2X2,
  Layers3,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Sparkle,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Conversation, ConversationContent } from "@/design-system/design-system-hub-ba3841/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/design-system/design-system-hub-ba3841/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/design-system/design-system-hub-ba3841/components/ai-elements/prompt-input";
import { Button } from "@/design-system/design-system-hub-ba3841/components/ui/button";
import { Checkbox } from "@/design-system/design-system-hub-ba3841/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/design-system/design-system-hub-ba3841/components/ui/dialog";
import { Input } from "@/design-system/design-system-hub-ba3841/components/ui/input";
import { Label } from "@/design-system/design-system-hub-ba3841/components/ui/label";
import { Progress } from "@/design-system/design-system-hub-ba3841/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/design-system/design-system-hub-ba3841/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system/design-system-hub-ba3841/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/design-system/design-system-hub-ba3841/components/ui/sheet";
import { Slider } from "@/design-system/design-system-hub-ba3841/components/ui/slider";
import { Switch } from "@/design-system/design-system-hub-ba3841/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/design-system/design-system-hub-ba3841/components/ui/tabs";
import landscape from "@/design-system/design-system-hub-ba3841/assets/cupola-landscape.webp.asset.json";
import logo from "@/design-system/design-system-hub-ba3841/assets/cupola-logo.svg.asset.json";
import mark from "@/design-system/design-system-hub-ba3841/assets/cupola-mark.svg.asset.json";

const navGroups = [
  {
    title: "FUNDAMENTOS",
    items: [
      "Cores",
      "Superfícies e materiais",
      "Gradientes e atmosferas",
      "Biblioteca de gradientes",
      "Tipografia",
      "Espaçamento e forma",
      "Iconografia",
      "Tokens reutilizáveis",
      "Movimento",
    ],
  },
  {
    title: "COMPONENTES",
    items: [
      "Básicos",
      "Conversas e prompts",
      "Conversa ao vivo",
      "Imagens e arquivos",
      "Agentes e tarefas",
      "Projetos e créditos",
    ],
  },
];

const colors = [
  ["Fundo", "#F6F7F4", "bg-background"],
  ["Superfície", "#FFFFFF", "bg-card"],
  ["Vidro", "16%", "bg-glass"],
  ["Texto principal", "#2D4247", "bg-foreground"],
  ["Mineral", "#E8EEE5", "bg-secondary"],
  ["Texto secundário", "#627477", "bg-muted-foreground"],
  ["Floresta", "#0A342A", "bg-primary"],
  ["Lima CUPOLA", "#B0F90A", "bg-brand"],
  ["Sucesso", "#2D6B54", "bg-success"],
  ["Atenção", "#88641F", "bg-warning"],
  ["Erro", "#B64450", "bg-destructive"],
  ["Informação", "#315E7A", "bg-info"],
] as const;

const sections = ["overview", "foundations", "motion", "basics", "ai"];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <p>{description}</p>
    </div>
  );
}

function DemoCard({
  number,
  label,
  title,
  copy,
  children,
}: {
  number: string;
  label: string;
  title: string;
  copy: string;
  children: ReactNode;
}) {
  return (
    <article className="demo-card">
      <div className="demo-stage">{children}</div>
      <p className="eyebrow">
        {number} / {label}
      </p>
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
  );
}

function Sidebar({ onSearch }: { onSearch: () => void }) {
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <img src={logo.url} alt="CupolaOS UI" />
        <span>1.0</span>
      </div>
      <Button variant="ghost" className="workspace">
        <Bot /> Workspace do agente
      </Button>
      <Button variant="outline" className="side-search" onClick={onSearch}>
        <Search /> Buscar componente <kbd>⌘ K</kbd>
      </Button>
      <Button variant="ghost" className="side-active" onClick={() => scrollTo("overview")}>
        <Grid2X2 /> Visão geral
      </Button>
      {navGroups.map((group) => (
        <div className="nav-group" key={group.title}>
          <p>{group.title}</p>
          {group.items.map((item, i) => (
            <Button
              variant="ghost"
              key={item}
              onClick={() =>
                scrollTo(
                  i > 7
                    ? "motion"
                    : group.title === "FUNDAMENTOS"
                      ? "foundations"
                      : i === 0
                        ? "basics"
                        : "ai",
                )
              }
            >
              {i % 3 === 0 ? <Layers3 /> : i % 3 === 1 ? <MessageSquare /> : <Sparkle />} {item}
            </Button>
          ))}
        </div>
      ))}
      <div className="sidebar-foot">
        <img src={mark.url} alt="" />
        <span>
          <b>CupolaOS</b>Inteligência em conjunto.
        </span>
      </div>
    </aside>
  );
}

function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const commands: Array<[string, string, string]> = [
    ["Cores e superfícies", "foundations", "Fundamentos"],
    ["Materiais de vidro", "foundations", "Fundamentos"],
    ["Demonstrações de movimento", "motion", "Movimento"],
    ["Botões e campos", "basics", "Componentes"],
    ["Conversa e prompt", "ai", "IA"],
    ["Agentes e tarefas", "ai", "IA"],
  ];
  const filtered = commands.filter((item) => item[0].toLowerCase().includes(query.toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="command-dialog">
        <DialogHeader>
          <DialogTitle>Buscar na biblioteca</DialogTitle>
          <DialogDescription>Encontre componentes, fundamentos e demonstrações.</DialogDescription>
        </DialogHeader>
        <div className="command-input">
          <Search />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar componentes e ações…"
          />
        </div>
        <div className="command-results">
          {filtered.map(([name, target, group]) => (
            <Button
              variant="ghost"
              key={name}
              onClick={() => {
                setOpen(false);
                scrollTo(target);
              }}
            >
              <span>
                <b>{name}</b>
                <small>{group}</small>
              </span>
              <ChevronRight />
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Hero() {
  return (
    <section className="hero" id="overview">
      <div className="hero-copy">
        <p className="eyebrow bright">
          <i /> CupolaOS / DESIGN SYSTEM
        </p>
        <h1>
          Inteligência em conjunto.
          <br />
          <span>Design em sintonia.</span>
        </h1>
        <p>
          Uma linguagem compartilhada para conversar, criar e construir.
          <br />
          Da menor interação à próxima grande ideia.
        </p>
        <div className="hero-actions">
          <Button onClick={() => scrollTo("foundations")}>
            Explorar a biblioteca <ArrowRight />
          </Button>
          <Button variant="outline" onClick={() => downloadTokens()}>
            <Code2 /> Baixar tokens
          </Button>
        </div>
      </div>
      <div className="hero-symbol">
        <span className="orbit orbit-one" />
        <span className="orbit orbit-two" />
        <img src={mark.url} alt="Símbolo CupolaOS" />
        <p>CONEXÕES QUE CRIAM.</p>
      </div>
      <div className="hero-bottom">
        <span>CLAREZA NA FORMA. POTÊNCIA NA EXPERIÊNCIA.</span>
        <span>01 — 03</span>
      </div>
    </section>
  );
}

function downloadTokens() {
  const tokens = {
    color: {
      background: "#F6F7F4",
      surface: "#FFFFFF",
      forest: "#0A342A",
      lime: "#B0F90A",
      text: "#2D4247",
    },
    radius: { sm: 8, md: 16, lg: 24, pill: 999 },
    motion: { fast: 160, base: 200, panel: 250 },
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(tokens, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "cupola-tokens.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function Foundations() {
  const [atmosphere, setAtmosphere] = useState("aurora");
  return (
    <section className="catalog-section" id="foundations">
      <SectionHeading
        eyebrow="01 / CupolaOS"
        title="Fundamentos"
        description="Uma base compartilhada para todas as experiências."
      />
      <div className="showcase-panel">
        <div className="panel-title">
          <div>
            <h3>Cores e superfícies</h3>
            <p>Selecione uma cor para copiar seu valor.</p>
          </div>
          <span>16 TOKENS</span>
        </div>
        <div className="swatch-grid">
          {colors.map(([name, value, className]) => (
            <Button
              variant="ghost"
              className="swatch"
              key={name}
              onClick={() => {
                navigator.clipboard?.writeText(value);
                toast.success(`${value} copiado`);
              }}
            >
              <i className={className} />
              <span>
                <b>{name}</b>
                <code>{value}</code>
              </span>
            </Button>
          ))}
        </div>
      </div>
      <div className={`atmosphere ${atmosphere}`}>
        <div className="atmosphere-switch">
          <span>Troque o fundo e observe como o vidro responde à luz.</span>
          <div>
            {["aurora", "oceano", "rose"].map((item) => (
              <Button
                size="sm"
                variant={atmosphere === item ? "default" : "ghost"}
                onClick={() => setAtmosphere(item)}
                key={item}
              >
                {item === "rose" ? "Rosé" : `${item.charAt(0).toUpperCase()}${item.slice(1)}`}
              </Button>
            ))}
          </div>
        </div>
        <div className="glass-grid">
          {[
            ["01", "CLEAR", "Leve por natureza.", "12 px blur · 10% tint"],
            ["02", "FROSTED", "Um pouco mais perto.", "32 px blur · 28% tint"],
            ["03", "LIQUID", "Uma nova dimensão.", "24 px blur · optical rim"],
          ].map(([n, l, t, d], i) => (
            <div className={`glass-card glass-${i}`} key={l}>
              <p>
                {n} / {l}
              </p>
              <h3>{t}</h3>
              <span>{d}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="foundation-grid">
        <div className="showcase-panel type-panel">
          <div className="panel-title">
            <div>
              <h3>Tipografia</h3>
              <p>Clara em cada escala.</p>
            </div>
          </div>
          {[
            ["Boas-vindas", "32 / 40"],
            ["Título principal", "72 / 73"],
            ["Título de seção", "40 / 46"],
            ["Subtítulo", "24 / 31"],
            ["Texto", "16 / 26"],
            ["Legenda", "12 / 18"],
          ].map(([t, s], i) => (
            <div className={`type-row t-${i}`} key={t}>
              <span>
                {t}
                <small>{s}</small>
              </span>
              <b>
                {i === 0
                  ? "O que vamos criar hoje?"
                  : i === 1
                    ? "Ideias."
                    : i === 2
                      ? "Um espaço para criar"
                      : i === 3
                        ? "Sua próxima descoberta"
                        : i === 4
                          ? "Cada conversa abre novas possibilidades."
                          : "Atualizado há 2 minutos"}
              </b>
            </div>
          ))}
        </div>
        <div className="showcase-panel spacing-panel">
          <div className="panel-title">
            <div>
              <h3>Espaçamento e forma</h3>
              <p>Um ritmo que aproxima cada peça.</p>
            </div>
          </div>
          <div className="space-bars">
            {[4, 8, 12, 16, 24, 32, 48, 64].map((n) => (
              <div key={n}>
                <span style={{ width: `${n * 2}px` }} />
                <code>{String(n).padStart(2, "0")}</code>
                <small>{n / 16} rem</small>
              </div>
            ))}
          </div>
          <div className="radius-row">
            {["8 px", "16 px", "24 px", "pill"].map((r, i) => (
              <i key={r} className={`radius-${i}`}>
                {r}
              </i>
            ))}
          </div>
          <pre>
            <code>{`// Superfície CUPOLA\nbackground: var(--cupola-glass);\nborder-radius: var(--cupola-radius-lg);\nbox-shadow: var(--cupola-shadow-soft);`}</code>
          </pre>
          <Button variant="outline" onClick={downloadTokens}>
            <ArrowDownToLine /> Baixar tokens em JSON
          </Button>
        </div>
      </div>
    </section>
  );
}

function MotionSection() {
  const [slow, setSlow] = useState(false);
  const [sent, setSent] = useState(0);
  const [segment, setSegment] = useState("Criar");
  const [files, setFiles] = useState(false);
  const [count, setCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  return (
    <section className={`catalog-section motion-section ${slow ? "slow-motion" : ""}`} id="motion">
      <div className="motion-top">
        <div>
          <p className="eyebrow">MOVIMENTO</p>
          <h2>Suave ao entrar. Imediato ao responder.</h2>
        </div>
        <div>
          <Label htmlFor="slow">Câmera lenta</Label>
          <Switch id="slow" checked={slow} onCheckedChange={setSlow} />
        </div>
      </div>
      <div className="motion-grid">
        <DemoCard
          number="01"
          label="PRESSÃO E RESPOSTA"
          title="Um clique, uma resposta"
          copy="Pressão tátil, carregamento e confirmação no mesmo botão."
        >
          <Button
            onClick={() => {
              setSent(1);
              setTimeout(() => setSent(2), 700);
              setTimeout(() => setSent(0), 1800);
            }}
          >
            {sent === 0 ? (
              <>
                Enviar ideia <Send />
              </>
            ) : sent === 1 ? (
              <>
                Enviando… <RefreshCw className="spin" />
              </>
            ) : (
              <>
                Enviado <Check />
              </>
            )}
          </Button>
        </DemoCard>
        <DemoCard
          number="02"
          label="SELEÇÃO CONTÍNUA"
          title="O contexto acompanha você"
          copy="O vidro desliza junto com a seleção."
        >
          <div className="segment">
            {["Ideia", "Criar", "Refinar"].map((x) => (
              <Button
                size="sm"
                variant={segment === x ? "default" : "ghost"}
                onClick={() => setSegment(x)}
                key={x}
              >
                {x}
              </Button>
            ))}
          </div>
        </DemoCard>
        <DemoCard
          number="03"
          label="CONFIRMAÇÃO"
          title="Um pequeno momento de certeza"
          copy="Toque no ícone para confirmar."
        >
          <Button
            size="icon"
            className="confirm-button"
            onClick={() => toast.success("Confirmado")}
            aria-label="Confirmar"
          >
            <Check />
          </Button>
        </DemoCard>
        <DemoCard
          number="04"
          label="ENTRADA EM SEQUÊNCIA"
          title="Uma coisa de cada vez"
          copy="Uma sequência curta dá ritmo à chegada."
        >
          <div className="file-stack">
            {files &&
              ["Briefing.pdf", "Referências.png", "Pesquisa.md"].map((x, i) => (
                <span key={x} style={{ animationDelay: `${i * 120}ms` }}>
                  <FileText />
                  {x}
                </span>
              ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => setFiles(!files)}>
            {files ? "Ocultar" : "Mostrar arquivos"}
          </Button>
        </DemoCard>
        <DemoCard
          number="05"
          label="MUDANÇA DE ESTADO"
          title="Cada descoberta conta"
          copy="Uma transição breve marca informação nova."
        >
          <Button variant="ghost" className="counter" onClick={() => setCount(count + 1)}>
            <b>{String(count).padStart(2, "0")}</b>
            <span>descobertas</span>
            <Plus />
          </Button>
        </DemoCard>
        <DemoCard
          number="06"
          label="GERAÇÃO"
          title="A inteligência está trabalhando"
          copy="O ritmo aparece durante a geração."
        >
          <Button
            variant="outline"
            className={generating ? "generating" : ""}
            onClick={() => {
              setGenerating(true);
              setTimeout(() => setGenerating(false), 2200);
            }}
          >
            {generating ? (
              <>
                <RefreshCw className="spin" /> Gerando
              </>
            ) : (
              <>
                <Wand2 /> Toque para gerar
              </>
            )}
          </Button>
        </DemoCard>
      </div>
    </section>
  );
}

function Basics() {
  const [loading, setLoading] = useState(false);
  const [creativity, setCreativity] = useState([65]);
  return (
    <section className="catalog-section" id="basics">
      <SectionHeading
        eyebrow="02 / CupolaOS"
        title="Componentes básicos"
        description="Peças essenciais, prontas para se combinar."
      />
      <div className="component-grid">
        <div className="showcase-panel">
          <div className="panel-title">
            <div>
              <h3>Botões</h3>
              <p>Ações com hierarquia clara.</p>
            </div>
          </div>
          <div className="button-gallery">
            <Button>Criar projeto</Button>
            <Button variant="secondary">Criar projeto</Button>
            <Button variant="outline">Criar projeto</Button>
            <Button variant="ghost">Discreto</Button>
            <Button variant="destructive">Excluir</Button>
            <Button
              onClick={() => {
                setLoading(true);
                setTimeout(() => setLoading(false), 1500);
              }}
              disabled={loading}
            >
              {loading ? <RefreshCw className="spin" /> : <Plus />}
              {loading ? "Carregando" : "Com ícone"}
            </Button>
          </div>
          <div className="state-row">
            {["Padrão", "Hover", "Foco", "Selecionado", "Indisponível"].map((x, i) => (
              <Button
                variant="outline"
                disabled={i === 4}
                className={
                  i === 1
                    ? "forced-hover"
                    : i === 2
                      ? "forced-focus"
                      : i === 3
                        ? "forced-selected"
                        : ""
                }
                key={x}
              >
                {x}
              </Button>
            ))}
          </div>
        </div>
        <div className="showcase-panel form-panel">
          <div className="panel-title">
            <div>
              <h3>Campos e seletores</h3>
              <p>Entrada com contexto e orientação.</p>
            </div>
          </div>
          <div className="fields">
            <div>
              <Label>Nome do projeto</Label>
              <Input placeholder="Identidade da Aurora" />
              <small>Escolha um nome fácil de encontrar.</small>
            </div>
            <div>
              <Label>Busca</Label>
              <div className="input-icon">
                <Search />
                <Input placeholder="Buscar componentes" />
              </div>
            </div>
            <div>
              <Label>Idioma das respostas</Label>
              <Select defaultValue="pt">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt">Português (Brasil)</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input placeholder="Conte sobre seu projeto" />
            </div>
          </div>
          <div className="choice-row">
            <Label className="check">
              <Checkbox defaultChecked />
              Buscar na web
            </Label>
            <Label className="check">
              <Checkbox defaultChecked />
              Arquivos do projeto
            </Label>
            <Label className="check">
              <Checkbox />
              Conexões externas
            </Label>
          </div>
          <RadioGroup defaultValue="short" className="radio-row">
            <Label>
              <RadioGroupItem value="short" />
              Resumo objetivo
            </Label>
            <Label>
              <RadioGroupItem value="long" />
              Análise detalhada
            </Label>
          </RadioGroup>
          <div className="slider-row">
            <span>Mais preciso</span>
            <Slider value={creativity} onValueChange={setCreativity} />
            <span>Mais criativo</span>
            <b>{creativity}%</b>
          </div>
        </div>
        <div className="showcase-panel span-two">
          <div className="panel-title">
            <div>
              <h3>Feedback e sobreposições</h3>
              <p>O contexto permanece mesmo quando uma camada se abre.</p>
            </div>
          </div>
          <div className="status-row">
            <span className="status success">
              <i />
              Concluído
            </span>
            <span className="status info">
              <i />
              Em execução
            </span>
            <span className="status warning">
              <i />
              Aguardando
            </span>
            <span className="status error">
              <i />
              Falhou
            </span>
            <span className="status">
              <i />
              Pausado
            </span>
          </div>
          <div className="overlay-actions">
            <Dialog>
              <DialogTrigger asChild>
                <Button>Abrir modal</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Seu contexto faz a diferença</DialogTitle>
                  <DialogDescription>
                    Adicione arquivos para receber respostas mais relevantes.
                  </DialogDescription>
                </DialogHeader>
                <Button>
                  <Upload />
                  Selecionar arquivos
                </Button>
              </DialogContent>
            </Dialog>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Abrir drawer</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Ações do projeto</SheetTitle>
                  <SheetDescription>
                    Organize e compartilhe a Identidade da Aurora.
                  </SheetDescription>
                </SheetHeader>
                <div className="drawer-list">
                  <Button variant="ghost">
                    <FileText />
                    Exportar briefing
                  </Button>
                  <Button variant="ghost">
                    <Copy />
                    Duplicar projeto
                  </Button>
                  <Button variant="ghost">
                    <SlidersHorizontal />
                    Configurações
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <Button
              variant="outline"
              onClick={() =>
                toast.success("Tudo pronto para começar", {
                  description: "Seus arquivos foram processados.",
                })
              }
            >
              Exibir toast
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function AiSection() {
  const [messages, setMessages] = useState([
    { role: "user" as const, text: "Como podemos começar a identidade da Aurora?" },
    {
      role: "assistant" as const,
      text: "Vamos começar pela essência: o que a Aurora representa e como quer ser percebida. Depois, traduzimos isso em três pilares — voz, cor e forma — para criar uma identidade que faça sentido em cada ponto de contato.",
    },
  ]);
  const [status, setStatus] = useState<"ready" | "submitted">("ready");
  const [running, setRunning] = useState(false);
  const [approved, setApproved] = useState(false);
  const [credits, setCredits] = useState(320);
  return (
    <section className="catalog-section" id="ai">
      <SectionHeading
        eyebrow="03 / CupolaOS"
        title="Componentes de IA"
        description="Inteligência com contexto, clareza e controle."
      />
      <div className="ai-grid">
        <div className="showcase-panel chat-panel">
          <div className="chat-head">
            <div>
              <img src={mark.url} alt="" />
              <span>
                <b>CUPOLA</b>CUPOLA Pro
              </span>
            </div>
            <Button size="icon" variant="ghost" aria-label="Mais opções">
              <MoreHorizontal />
            </Button>
          </div>
          <Conversation className="conversation">
            <ConversationContent>
              {messages.map((message, index) => (
                <Message from={message.role} key={`${message.role}-${index}`}>
                  <MessageContent>
                    {message.role === "assistant" ? (
                      <MessageResponse>{message.text}</MessageResponse>
                    ) : (
                      message.text
                    )}
                  </MessageContent>
                </Message>
              ))}
            </ConversationContent>
          </Conversation>
          <PromptInput
            className="cupola-prompt"
            onSubmit={({ text }) => {
              if (!text.trim()) return;
              setMessages((m) => [...m, { role: "user", text }]);
              setStatus("submitted");
              setTimeout(() => {
                setMessages((m) => [
                  ...m,
                  {
                    role: "assistant",
                    text: "Ótimo ponto de partida. Vou organizar essa ideia em uma direção clara para o projeto.",
                  },
                ]);
                setStatus("ready");
              }, 900);
            }}
          >
            <PromptInputTextarea placeholder="Escreva uma mensagem ou escolha um ponto de partida." />
            <PromptInputFooter>
              <PromptInputTools>
                <Button size="sm" variant="ghost">
                  <Paperclip />
                  Arquivos
                </Button>
                <Button size="sm" variant="ghost">
                  <Search />
                  Busca na web
                </Button>
              </PromptInputTools>
              <PromptInputSubmit status={status} />
            </PromptInputFooter>
          </PromptInput>
        </div>
        <article className="image-result">
          <img
            src={landscape.url}
            alt="Paisagem surreal azul glacial, com dunas translúcidas e uma lua perolada"
          />
          <div>
            <span className="eyebrow">16:9 · CUPOLA VISION</span>
            <h3>Silêncio em azul</h3>
            <p>
              Paisagem surreal, dunas translúcidas e uma lua perolada. Luz difusa, tons de azul
              glacial.
            </p>
            <div>
              <Button size="sm" variant="outline">
                <ArrowDownToLine />
                Baixar
              </Button>
              <Button size="sm">
                <Wand2 />
                Criar variação
              </Button>
            </div>
          </div>
        </article>
        <article className="upload-card">
          <Upload />
          <h3>Solte suas ideias aqui</h3>
          <p>PDF, TXT, Markdown e imagens · até 20 MB</p>
          <Button
            variant="outline"
            onClick={() => toast.success("Arquivo adicionado à demonstração")}
          >
            Selecionar arquivos
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              toast.error("Não foi possível concluir", {
                description: "Tente novamente em alguns instantes.",
              })
            }
          >
            Demonstrar erro de upload
          </Button>
          <small>Arquivos ficam apenas nesta sessão de demonstração.</small>
        </article>
        <article className="agent-card">
          <div className="agent-top">
            <div className="agent-avatar">Í</div>
            <div>
              <span>Disponível</span>
              <h3>Íris</h3>
              <p>Sua parceira de pesquisa</p>
            </div>
            <Button
              size="icon"
              variant="outline"
              aria-label={running ? "Pausar agente" : "Executar agente"}
              onClick={() => setRunning(!running)}
            >
              {running ? <Pause /> : <Play />}
            </Button>
          </div>
          <p>Conecta referências, encontra perspectivas e transforma perguntas em descobertas.</p>
          <div className="tool-pills">
            <span>Busca</span>
            <span>Arquivos</span>
            <span>Imagens</span>
          </div>
          <h4>ETAPAS DE EXECUÇÃO</h4>
          {["Ler o briefing", "Buscar referências", "Organizar descobertas"].map((step, i) => (
            <div className="task" key={step}>
              <i className={running && i === 0 ? "active" : running && i < 3 ? "done" : ""}>
                {running && i > 0 ? <Check /> : i + 1}
              </i>
              <b>{step}</b>
              <span>{running ? (i === 0 ? "Em execução" : "Concluído") : "Aguardando"}</span>
            </div>
          ))}
        </article>
        <article className="approval-card">
          <div className="approval-icon">
            <CircleAlert />
          </div>
          <div>
            <span className="eyebrow">SUA APROVAÇÃO É IMPORTANTE</span>
            <h3>{approved ? "Ação aprovada" : "Íris quer adicionar um arquivo"}</h3>
            <p>
              {approved
                ? "Pesquisa de referências.md foi adicionada ao projeto Aurora."
                : "Revise o resumo antes de adicioná-lo ao projeto Aurora."}
            </p>
            <div className="file-line">
              <FileText />
              <span>
                <b>Pesquisa de referências.md</b>Projeto Aurora · 4,2 KB
              </span>
            </div>
            {!approved && (
              <div>
                <Button onClick={() => setApproved(true)}>Aprovar ação</Button>
                <Button variant="ghost">Cancelar</Button>
              </div>
            )}
          </div>
        </article>
        <article className="project-card">
          <span className="eyebrow">EM ANDAMENTO</span>
          <div className="project-icon">
            <Layers3 />
          </div>
          <h3>Identidade da Aurora</h3>
          <p>Estratégia e linguagem visual para uma marca que está nascendo.</p>
          <div className="project-meta">
            <span>8 arquivos</span>
            <span>12 conversas</span>
            <span>Há 2 horas</span>
          </div>
          <Button variant="outline">
            Explorar projeto <ArrowRight />
          </Button>
        </article>
        <article className="credits-card">
          <span>Seus créditos</span>
          <b>{credits}</b>
          <small>disponíveis</small>
          <Progress value={(1000 - credits) / 10} />
          <div>
            <span>{1000 - credits} utilizados</span>
            <span>Limite de 1.000</span>
          </div>
          <p>Renovação em 1º de outubro</p>
          <Button variant="outline" onClick={() => setCredits(Math.max(0, credits - 80))}>
            Simular consumo · 80 créditos
          </Button>
          <Button variant="ghost" onClick={() => setCredits(320)}>
            Restaurar saldo
          </Button>
        </article>
      </div>
    </section>
  );
}

export function CupolaCatalog() {
  const [commandOpen, setCommandOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState("overview");
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        }),
      { rootMargin: "-20% 0px -65%" },
    );
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);
  const currentLabel = useMemo(
    () =>
      ({
        overview: "Visão geral",
        foundations: "Fundamentos",
        motion: "Movimento",
        basics: "Componentes básicos",
        ai: "Componentes de IA",
      })[active],
    [active],
  );
  return (
    <div className="app-shell">
      <Sidebar onSearch={() => setCommandOpen(true)} />
      <CommandPalette open={commandOpen} setOpen={setCommandOpen} />
      <header className="topbar">
        <Button
          size="icon"
          variant="ghost"
          className="mobile-menu"
          aria-label="Abrir menu"
          onClick={() => setMenuOpen(true)}
        >
          <Menu />
        </Button>
        <span>Design system</span>
        <i>/</i>
        <b>{currentLabel}</b>
        <div>
          <i />
          Biblioteca v1.0 <span>GF</span>
        </div>
      </header>
      {menuOpen && (
        <div className="mobile-drawer">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
          >
            <X />
          </Button>
          <img src={logo.url} alt="CupolaOS" />
          {sections.map((id) => (
            <Button
              variant="ghost"
              key={id}
              onClick={() => {
                scrollTo(id);
                setMenuOpen(false);
              }}
            >
              {
                (
                  {
                    overview: "Visão geral",
                    foundations: "Fundamentos",
                    motion: "Movimento",
                    basics: "Componentes básicos",
                    ai: "Componentes de IA",
                  } as Record<string, string>
                )[id]
              }
            </Button>
          ))}
        </div>
      )}
      <main>
        <div className="document-line">
          <span>O SISTEMA POR TRÁS DAS POSSIBILIDADES</span>
          <span>DOCUMENTAÇÃO · SETEMBRO 2026</span>
        </div>
        <Hero />
        <div className="library-links">
          {(
            [
              ["01", "Fundamentos", "A essência em cada detalhe", "foundations"],
              ["02", "Componentes básicos", "Peças que trabalham juntas", "basics"],
              ["03", "Componentes de IA", "Inteligência que ganha forma", "ai"],
            ] as Array<[string, string, string, string]>
          ).map(([n, t, d, id]) => (
            <Button variant="outline" key={t} onClick={() => scrollTo(id)}>
              <span>{n} / BIBLIOTECA</span>
              <b>{t}</b>
              <small>{d}</small>
              <ArrowRight />
            </Button>
          ))}
        </div>
        <nav className="section-nav">
          {sections.map((id) => (
            <Button
              size="sm"
              variant={active === id ? "default" : "ghost"}
              key={id}
              onClick={() => scrollTo(id)}
            >
              {
                (
                  {
                    overview: "Visão geral",
                    foundations: "Fundamentos",
                    motion: "Movimento",
                    basics: "Componentes básicos",
                    ai: "Componentes de IA",
                  } as Record<string, string>
                )[id]
              }
            </Button>
          ))}
          <span>33 famílias de componentes</span>
        </nav>
        <Foundations />
        <MotionSection />
        <Basics />
        <AiSection />
        <footer>
          <img src={mark.url} alt="" />
          <span>
            <b>CupolaOS</b>Uma linguagem compartilhada para construir o próximo passo.
          </span>
          <small>DESIGN SYSTEM · 2026</small>
        </footer>
      </main>
    </div>
  );
}
