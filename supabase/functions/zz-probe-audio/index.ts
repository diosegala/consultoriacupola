// Sonda temporária: descobre qual caminho de transcrição o gateway aceita.
const key = Deno.env.get("LOVABLE_API_KEY") ?? "";

Deno.serve(async (req) => {
  const { base64, mime } = await req.json().catch(() => ({ base64: "", mime: "audio/mp3" }));
  const bytes = Uint8Array.from(atob(base64 || ""), (c) => c.charCodeAt(0));
  const out: Record<string, unknown> = {};

  for (const modelo of ["google/gemini-3.5-transcribe", "openai/gpt-4o-mini-transcribe"]) {
    const fd = new FormData();
    fd.append("file", new Blob([bytes], { type: mime }), "a.mp3");
    fd.append("model", modelo);
    const r = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: fd,
    });
    out[modelo] = { status: r.status, body: (await r.text()).slice(0, 300) };
  }

  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
});
