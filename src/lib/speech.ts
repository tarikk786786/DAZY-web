import type { DazyState } from "./types";

// Indian English / Hindi voices, Neerja-first (same as desktop DAZY).
export const VOICE_OPTIONS = [
  { id: "neerja", label: "Neerja (Indian English, like desktop)", match: /neerja|hi[-_]IN/i },
  { id: "india-en", label: "Indian English (auto)", match: /en[-_]IN/i },
  { id: "hindi", label: "Hindi", match: /^hi(?![-_]IN)/i },
  { id: "default", label: "Browser default", match: null },
] as const;

export type VoiceChoice = (typeof VOICE_OPTIONS)[number]["id"];

export function listVoices(): SpeechSynthesisVoice[] {
  try {
    return window.speechSynthesis?.getVoices() ?? [];
  } catch {
    return [];
  }
}

function pickVoice(choice: VoiceChoice): SpeechSynthesisVoice | null {
  const voices = listVoices();
  const option = VOICE_OPTIONS.find((o) => o.id === choice);
  if (option?.match) {
    const hit = voices.find((v) => option.match!.test(v.name) || option.match!.test(v.lang));
    if (hit) return hit;
  }
  return voices.find((v) => /en[-_]IN/i.test(v.lang)) ?? voices.find((v) => /hi/i.test(v.lang)) ?? voices[0] ?? null;
}

let currentVoice: VoiceChoice = "neerja";

export function setVoiceChoice(choice: VoiceChoice) {
  currentVoice = choice;
}

export function speak(text: string, _state: DazyState, onDone?: () => void) {
  try {
    if (!("speechSynthesis" in window) || !text.trim()) {
      onDone?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(currentVoice);
    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang;
    } else {
      utter.lang = "en-IN";
    }
    utter.rate = 1.0;
    utter.pitch = 1.12;
    utter.onend = () => onDone?.();
    utter.onerror = () => onDone?.();
    window.speechSynthesis.speak(utter);
  } catch {
    onDone?.();
  }
}

export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // ignore
  }
}

export function playChime(kind: "alert" | "send" = "alert") {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    if (kind === "alert") {
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(660, now + 0.15);
      osc.frequency.setValueAtTime(880, now + 0.3);
    } else {
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(760, now + 0.08);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "alert" ? 0.55 : 0.2));
    osc.start(now);
    osc.stop(now + 0.6);
    osc.onended = () => ctx.close();
  } catch {
    // audio not available
  }
}
