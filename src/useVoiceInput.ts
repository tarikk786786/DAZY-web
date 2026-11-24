import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
  resultIndex: number;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/** Always-listening voice input: auto-restarts, interim transcripts, echo pause. */
export function useVoiceInput(opts: { onFinal: (text: string) => void; paused: boolean }) {
  const { onFinal, paused } = opts;
  const [alwaysOn, setAlwaysOn] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantOnRef = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const restartTimer = useRef<number | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    setSupported(true);

    const rec = new Ctor();
    rec.lang = "hi-IN";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal && t.trim()) {
          if (!pausedRef.current) onFinal(t.trim());
          interimText = "";
        } else {
          interimText += t;
        }
      }
      setInterim(interimText);
    };

    const restart = () => {
      setInterim("");
      if (!wantOnRef.current) return;
      if (restartTimer.current) window.clearTimeout(restartTimer.current);
      restartTimer.current = window.setTimeout(() => {
        if (!wantOnRef.current) return;
        try {
          rec.start();
        } catch {
          // already started
        }
      }, 250);
    };

    rec.onend = restart;
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantOnRef.current = false;
        setAlwaysOn(false);
      }
      restart();
    };

    recRef.current = rec;
    return () => {
      wantOnRef.current = false;
      try {
        rec.stop();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleAlways = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    if (alwaysOn) {
      wantOnRef.current = false;
      setAlwaysOn(false);
      try {
        rec.stop();
      } catch {
        // ignore
      }
      setInterim("");
    } else {
      wantOnRef.current = true;
      setAlwaysOn(true);
      try {
        rec.start();
      } catch {
        // already started
      }
    }
  }, [alwaysOn]);

  return { alwaysOn, toggleAlways, interim, supported };
}
