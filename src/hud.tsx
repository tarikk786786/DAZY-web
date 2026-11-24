import { useEffect, useRef, useState } from "react";
import type { DazyState, Memory, Reminder } from "./lib/types";

export function Reactor({ state }: { state: DazyState }) {
  const labels: Record<DazyState, string> = {
    idle: "STANDBY",
    listening: "LISTENING",
    thinking: "THINKING",
    speaking: "SPEAKING",
  };
  return (
    <div className="reactor-wrap">
      <div className={`reactor ${state}`}>
        <div className="reactor-ring" />
        <div className="reactor-ring r2" />
        <div className="reactor-ring r3" />
        <div className="reactor-orbit" />
        <div className="reactor-core" />
        <div className="reactor-glow" />
      </div>
      <div className="reactor-state">{labels[state]}</div>
    </div>
  );
}

export function Waveform({ state }: { state: DazyState }) {
  const active = state === "speaking" || state === "listening";
  return (
    <div className={`waveform ${active ? "active" : ""}`}>
      {Array.from({ length: 24 }, (_, i) => (
        <span
          key={i}
          style={{
            animationDelay: `${(i % 6) * 0.09}s`,
            animationDuration: `${0.7 + ((i * 7) % 5) * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}

export function StatusPanel({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="glass">
      <div className="panel-title">System Status</div>
      {items.map((g) => (
        <div className="gauge-row" key={g.label}>
          <span className="gauge-label">{g.label}</span>
          <span className="gauge-value">{g.value}</span>
        </div>
      ))}
    </div>
  );
}

export function MemoryPanel({ memories, onForget }: { memories: Memory[]; onForget: (id: string) => void }) {
  return (
    <div className="glass">
      <div className="panel-title">What She Remembers</div>
      {memories.length === 0 ? (
        <div className="empty-hint">Kuch bhi nahi abhi — talk to her and she'll start remembering the little things.</div>
      ) : (
        memories.map((m) => (
          <div className="mem-row" key={m.id}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mem-key">{m.key}</div>
              <div className="mem-value">{m.value}</div>
            </div>
            <button className="mem-forget" onClick={() => onForget(m.id)} title="Make her forget this">
              ✕
            </button>
          </div>
        ))
      )}
    </div>
  );
}

export function RemindersPanel({ reminders }: { reminders: Reminder[] }) {
  return (
    <div className="glass">
      <div className="panel-title">Upcoming</div>
      {reminders.length === 0 ? (
        <div className="empty-hint">No reminders yet. Try: "kal 9 baje mujhe utha dena".</div>
      ) : (
        reminders.map((r) => {
          const when = new Date(r.due_at).toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
          return (
            <div className="rem-row" key={r.id}>
              <div className="rem-title">{r.title}</div>
              <div className="rem-when">{when}</div>
            </div>
          );
        })
      )}
    </div>
  );
}

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: { id: string; title: string; when: string }[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div className="toast" key={t.id} onClick={() => onDismiss(t.id)}>
          <div className="toast-label">REMINDER</div>
          <div className="rem-title">{t.title}</div>
          <div className="rem-when">due {t.when} — tap to dismiss</div>
        </div>
      ))}
    </div>
  );
}

export function useIstClock(): string {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function useAutoScroll(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [dep]);
  return ref;
}
