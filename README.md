# DAZY — Web Personal AI Companion

A Hinglish-speaking AI girlfriend-companion with a JARVIS-style HUD, persistent memory,
voice conversation, and reminders. The web twin of [DAZY-ai](https://github.com/tarikk786786/DAZY-ai-new) (desktop).

## Features

- Natural Hinglish conversation with emotion-aware replies (10 emotional states)
- Always-listening voice input + Indian English / Hindi female voice output (Neerja)
- Permanent memory — she remembers your preferences, people, plans; delete anything
- Voice-set reminders with spoken pop-up alerts and chime
- Reactor-core HUD with live status, waveform, glass panels
- Provider-ladder brain: Groq (Qwen 3.8 27B) → OpenRouter → DeepSeek, with prompt
  compression so free tiers never rate-limit mid-conversation
- Everything persisted in Supabase (memories, chats, reminders)

## Setup

1. Create a free Supabase project and run the migrations in `supabase/migrations/`.
2. Deploy the edge function in `supabase/functions/dazy-chat/`
   (`supabase/config.toml` already registers it).
3. Add provider keys into the `provider_secrets` table (server-side only, never
   exposed to browsers): rows `groq`, `openrouter`, `deepseek` with your keys.
4. `npm install && npm run dev`

## Stack

Vite + React + TypeScript, Supabase (Postgres + Edge Functions),
Groq / OpenRouter / DeepSeek, Web Speech API for voice.

## Security notes

- Provider API keys live in the `provider_secrets` table, which has RLS enabled
  with no public policies — only the edge function (service role) can read them.
- The browser never sees any provider key.

## License

Personal, non-commercial use. Persona derived from DAZY-ai (CC BY-NC 4.0).
