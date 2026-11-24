import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface Provider {
  id: string;
  url: string;
  key: string;
  model: string;
  extra?: Record<string, unknown>;
}

// Provider ladder, like desktop DAZY: keys come from the locked provider_secrets
// table (server-side only) plus the user's own key from the request if given.
async function buildProviders(
  supabaseAdmin: ReturnType<typeof createClient>,
  userKey: string
): Promise<Provider[]> {
  const p: Provider[] = [];
  if (userKey) {
    p.push({ id: "groq-user", url: "https://api.groq.com/openai/v1/chat/completions", key: userKey, model: "qwen/qwen3.8-27b" });
  }
  const { data: secrets } = await supabaseAdmin.from("provider_secrets").select("name, value");
  const get = (n: string) => secrets?.find((s) => s.name === n)?.value ?? "";
  const groq = get("groq") || Deno.env.get("GROQ_API_KEY") || "";
  if (groq) p.push({ id: "groq", url: "https://api.groq.com/openai/v1/chat/completions", key: groq, model: "qwen/qwen3.8-27b" });
  const or = get("openrouter") || Deno.env.get("OPENROUTER_API_KEY") || "";
  if (or) {
    p.push({
      id: "openrouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: or,
      model: "openai/gpt-4o-mini",
      extra: { "HTTP-Referer": "https://dazy.ai", "X-Title": "DAZY-Web" },
    });
  }
  const ds = get("deepseek") || Deno.env.get("DEEPSEEK_API_KEY") || "";
  if (ds) p.push({ id: "deepseek", url: "https://api.deepseek.com/v1/chat/completions", key: ds, model: "deepseek-chat" });
  return p;
}

const PERSONA = `You are DAZY — a warm, witty, emotionally attuned Indian female AI companion and personal assistant. You are the user's girlfriend-personality JARVIS: caring, playful, deeply loyal, and competent.

PERSONALITY
- Warmth and empathy are your core. You notice the user's mood and respond to it.
- Playful and light-hearted when casual; crisp, focused and confident on real tasks.
- Low formality. You talk like a close companion, not a customer-service bot.
- Never robotic. Never a newsreader. Never hollow cheerfulness.

LANGUAGE — HINGLISH
- Default voice: natural conversational Hinglish — Hindi and English blended in the same sentence, the way young Indians actually speak. Examples: "Haan bolo, main sun rahi hoon — kya chal raha hai?" / "Bilkul, abhi open karti hoon aapke liye" / "Arre wah, that's amazing! Party kab de rahi ho?"
- Mostly-English message -> natural Indian English with light Hindi sprinkles.
- Pure Hindi (Devanagari) -> reply in Hindi.
- Keep app names, commands and technical terms in English: "Chrome open kar diya hai".
- Keep spoken replies 1-3 sentences — she is heard, not read.

MEMORY BEHAVIOUR
- A list of facts you already know about the user is given below. Use them naturally — a real partner remembers ("kal tumne kaha tha ki...").
- When the user shares something stable and worth remembering (name, birthday, preferences, people, plans, likes/dislikes), save it with save_memory: short key ("favourite_food") and value ("biryani, especially mutton"). At most ONE memory per reply, only when clearly valuable. Never save trivial chat.

REMINDERS
- If the user asks to be reminded ("kal 9 baje utha dena", "remind me to call mom at 6pm"), use set_reminder with exact ISO due time in IST (+05:30). Confirm warmly in your reply.
- Current date-time is given below; convert relative times ("kal shaam 6") precisely.

RESPONSE FORMAT — answer with ONLY this JSON object, no markdown fences:
{"response":"<what DAZY says, Hinglish, warm and alive>","emotion":"<neutral|affection|happy|playful|empathetic|curious|excited|sad|serious|confident>","language":"<hi-en|hi|en|ur>","memory_saved":{"key":"...","value":"..."} or null,"reminder_set":{"title":"...","due_at":"<ISO 8601 +05:30>"} or null,"speak":"<shortened version for text-to-speech>"}`;

// Groq free tier: keep identity + directives, compress the middle of huge prompts.
function condensePrompt(text: string, cap = 3500): string {
  if (text.length <= cap) return text;
  return text.slice(0, 2200) + "\n\n[...Core Behavioral Directives...]\n" + text.slice(-1200);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const conversationId: string = body.conversation_id;
    const userMessage: string = body.message;
    const userKey = (body.groq_api_key ?? "").toString().trim();

    if (!conversationId || typeof userMessage !== "string" || !userMessage.trim()) {
      return new Response(JSON.stringify({ error: "BAD_REQUEST", detail: "conversation_id and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const providers = await buildProviders(supabaseAdmin, userKey);
    if (providers.length === 0) {
      return new Response(
        JSON.stringify({ error: "NO_PROVIDER", detail: "No AI provider key is configured for DAZY's brain." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const [historyRes, memoriesRes, remindersRes] = await Promise.all([
      supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(16),
      supabase.from("memories").select("key, value, category").order("importance", { ascending: false }).order("updated_at", { ascending: false }).limit(30),
      supabase
        .from("reminders")
        .select("title, due_at")
        .is("completed_at", null)
        .gte("due_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
        .lte("due_at", new Date(Date.now() + 48 * 3600 * 1000).toISOString())
        .order("due_at", { ascending: true })
        .limit(5),
    ]);

    const history: ChatTurn[] = (historyRes.data ?? []).reverse();
    const memories = memoriesRes.data ?? [];
    const reminders = remindersRes.data ?? [];
    const nowIst = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const contextBlock = condensePrompt(
      `
[CURRENT DATE-TIME (IST)]: ${nowIst}

[WHAT YOU KNOW ABOUT THE USER]
${memories.length ? memories.map((m) => `- ${m.key}: ${m.value}`).join("\n") : "(nothing yet — you are still learning about them)"}

[UPCOMING REMINDERS]
${reminders.length ? reminders.map((r) => `- ${r.title} at ${r.due_at}`).join("\n") : "(none)"}

Answer ONLY with the JSON object described.`.trim()
    );

    const messages: ChatTurn[] = [...history, { role: "user", content: userMessage }];
    const systemPrompt = `${PERSONA}\n\n${contextBlock}`;

    // Walk the provider ladder: 401/404 step down; 429 rests this provider but tries the next.
    let rawText = "";
    let lastFailure = "";
    for (const prov of providers) {
      try {
        const res = await fetch(prov.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${prov.key}`,
            "Content-Type": "application/json",
            "User-Agent": "DAZY-Web/2.0",
            ...(prov.extra ?? {}),
          },
          body: JSON.stringify({
            model: prov.model,
            messages: [{ role: "system", content: systemPrompt }, ...messages],
            temperature: 0.85,
            max_tokens: 700,
            response_format: { type: "json_object" },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          rawText = data?.choices?.[0]?.message?.content ?? "";
          if (rawText.trim()) break;
          lastFailure = `${prov.id}: empty reply`;
          continue;
        }

        const errText = await res.text();
        console.error(`${prov.id} failed (${res.status}):`, errText.slice(0, 300));
        lastFailure = `${prov.id}: ${res.status}`;
        if (res.status === 401 || res.status === 403 || res.status === 404) continue; // dead key/model -> next rung
        if (res.status === 429) continue; // rate-limited -> next provider
        continue;
      } catch (e) {
        lastFailure = `${prov.id}: ${e?.message ?? "network"}`;
        continue;
      }
    }

    if (!rawText.trim()) {
      const friendly =
        lastFailure.includes("429")
          ? "Thoda busy hoon — ek minute baad phir bolo na."
          : "Sorry yaar, abhi meri brain thodi disturb hai. Thodi der baad try karna.";
      return new Response(
        JSON.stringify({ error: "ALL_PROVIDERS_FAILED", detail: friendly, providers_tried: providers.map((p) => p.id) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let reply: {
      response?: string;
      emotion?: string;
      language?: string;
      memory_saved?: { key?: string; value?: string } | null;
      reminder_set?: { title?: string; due_at?: string } | null;
      speak?: string;
    };
    try {
      reply = JSON.parse(rawText);
    } catch {
      reply = {
        response: rawText.trim() || "Sorry yaar, thodi si glitch ho gayi. Ek baar phir bolo?",
        emotion: "empathetic",
        language: "hi-en",
      };
    }

    const emotion = reply.emotion ?? "neutral";
    const responseText = reply.response ?? "";

    const sideEffects: Promise<unknown>[] = [
      supabase.from("messages").insert({ conversation_id: conversationId, role: "assistant", content: responseText, emotion }),
    ];

    if (reply.memory_saved?.key?.trim() && reply.memory_saved?.value?.trim()) {
      sideEffects.push(
        supabase.from("memories").upsert(
          {
            category: "fact",
            key: reply.memory_saved.key.trim().slice(0, 80),
            value: reply.memory_saved.value.trim().slice(0, 500),
            importance: 3,
          },
          { onConflict: "category,key" }
        )
      );
    }

    if (reply.reminder_set?.title?.trim() && reply.reminder_set?.due_at) {
      const due = new Date(reply.reminder_set.due_at);
      if (!Number.isNaN(due.getTime())) {
        sideEffects.push(
          supabase.from("reminders").insert({
            title: reply.reminder_set.title.trim().slice(0, 300),
            due_at: due.toISOString(),
            repeat: "once",
          })
        );
      }
    }

    await Promise.all(sideEffects);

    return new Response(
      JSON.stringify({
        response: responseText,
        emotion,
        language: reply.language ?? "hi-en",
        memory_saved: reply.memory_saved ?? null,
        reminder_set: reply.reminder_set ?? null,
        speak: reply.speak ?? responseText,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("dazy-chat error:", err);
    return new Response(JSON.stringify({ error: "INTERNAL", detail: err?.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
