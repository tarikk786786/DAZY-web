import { FormEvent, useCallback, useEffect, useState } from "react";
import { useDazy } from "./useDazy";
import { useVoiceInput } from "./useVoiceInput";
import { VOICE_OPTIONS, setVoiceChoice, playChime, type VoiceChoice } from "./lib/speech";
import { Reactor, RemindersPanel, StatusPanel, Toasts, Waveform, MemoryPanel, useAutoScroll, useIstClock } from "./hud";

const EMOTION_BADGES: Record<string, string> = {
  affection: "affectionate",
  happy: "happy",
  playful: "playful",
  empathetic: "empathetic",
  curious: "curious",
  excited: "excited",
  sad: "feeling low",
  serious: "serious",
  confident: "confident",
  neutral: "calm",
};

export default function App() {
  const dazy = useDazy();
  const { messages, state, error, setState, send, interrupt } = dazy;
  const [draft, setDraft] = useState("");
  const [voice, setVoice] = useState<VoiceChoice>("neerja");

  useEffect(() => setVoiceChoice(voice), [voice]);

  const paused = state === "speaking" || state === "thinking";

  const onFinalVoice = useCallback((text: string) => send(text), [send]);

  const { alwaysOn, toggleAlways, interim, supported } = useVoiceInput({ onFinal: onFinalVoice, paused });

  const chatRef = useAutoScroll(messages.length + state + interim);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || state === "thinking") return;
    const text = draft;
    setDraft("");
    playChime("send");
    send(text);
  };

  const err = error;

  const items = [
    { label: "Local time", value: useIstClock() },
    { label: "Memories", value: String(dazy.memories.length) },
    { label: "Reminders", value: String(dazy.reminders.length) },
    { label: "Mic", value: supported ? (alwaysOn ? "Always ON" : "Ready") : "Text only" },
  ];

  return (
    <div className="app-shell">
      <header className="hud-header">
        <div className="hud-logo">
          <div>
            <div className="hud-title">DAZY</div>
            <div className="hud-subtitle">Personal AI · Hinglish Companion</div>
          </div>
        </div>
        <div className="header-status">
          <span className={`status-dot ${err ? "off" : state === "idle" ? "" : "busy"}`} />
          {err ? "ATTENTION" : state === "idle" ? "ONLINE" : state.toUpperCase()}
        </div>
      </header>

      {interim && (
        <div className="interim-banner">
          <span className="status-dot busy" /> {interim}
        </div>
      )}

      <main className="hud-main">
        <aside className="side-panel">
          <div className="glass core-panel">
            <div className="panel-title">Core</div>
            <Reactor state={state === "idle" && alwaysOn ? "listening" : state} />
            <Waveform state={state} />
            {state === "speaking" && (
              <button className="btn-secondary interrupt-btn" onClick={interrupt}>
                Stop speaking
              </button>
            )}
          </div>
          <StatusPanel items={items} />
        </aside>

        <section className="chat-column">
          <div className="chat-scroll glass" ref={chatRef}>
            {dazy.booted && messages.length === 0 && (
              <div className="msg-row assistant">
                <div className="msg-avatar">D</div>
                <div>
                  <div className="msg-bubble">
                    Hi! Main DAZY hoon — aapki personal AI companion. Batao, aaj kya chal raha hai?
                    Mujhse kuch bhi kaha jaa sakta hai — apni pasand, important dates, ya bas
                    "kal 7 baje mujhe remind kar dena".
                  </div>
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div className={`msg-row ${m.role}`} key={m.id}>
                {m.role === "assistant" && <div className="msg-avatar">D</div>}
                <div style={{ maxWidth: "100%" }}>
                  <div className="msg-bubble">{m.content}</div>
                  {m.role === "assistant" && m.emotion && (
                    <div className="msg-emotion">{EMOTION_BADGES[m.emotion] ?? m.emotion}</div>
                  )}
                </div>
              </div>
            ))}

            {state === "thinking" && (
              <div className="msg-row assistant">
                <div className="msg-avatar">D</div>
                <div className="msg-bubble">
                  <span className="typing-dots"><span /><span /><span /></span>
                </div>
              </div>
            )}
          </div>

          {err && <div className="error-bar">{err.detail}</div>}

          <form className="input-bar glass" onSubmit={onSubmit}>
            <button
              type="button"
              className={`mic-btn ${alwaysOn ? "always" : ""} ${state === "listening" ? "recording" : ""}`}
              onClick={toggleAlways}
              title={supported ? "Toggle always-listening" : "Voice not supported in this browser"}
              disabled={!supported}
            >
              <MicIcon />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={state === "listening" ? "Sun rahi hoon — bolo..." : "Kuch bhi bolo... type ya mic on karo"}
            />
            <button className="send-btn" type="submit" disabled={!draft.trim() || state === "thinking"}>
              Send
            </button>
          </form>
        </section>

        <aside className="side-panel">
          <MemoryPanel memories={dazy.memories} onForget={dazy.forgetMemory} />
          <RemindersPanel reminders={dazy.reminders} />
          <div className="glass">
            <button className="btn-secondary full-width" onClick={dazy.clearChat}>Clear this conversation</button>
          </div>
        </aside>
      </main>

      <Toasts toasts={dazy.toasts} onDismiss={(id) => { dazy.toasts.length && setState("idle"); }} />
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
