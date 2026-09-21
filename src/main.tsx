import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@/design-system/design-system-hub-ba3841/styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

document.documentElement.classList.add("dark");
document.body.classList.add("font-sans", "bg-background", "text-foreground", "antialiased");

createRoot(rootElement).render(<App />);
