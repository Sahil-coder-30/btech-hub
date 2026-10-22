"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typing for the Web Speech API, which is not in lib.dom yet. */
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

/** Voice input through the browser's free speech recognition (Chrome, Edge, Safari). */
export function useSpeech(onText: (text: string, final: boolean) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const callback = useRef(onText);
  callback.current = onText;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-IN"; // understands Indian English and most Hinglish
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join("");
      const final = e.results[e.results.length - 1]?.isFinal ?? false;
      callback.current(text, final);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognition.current = rec;
    setSupported(true);
    return () => rec.stop();
  }, []);

  const toggle = useCallback(() => {
    if (!recognition.current) return;
    if (listening) {
      recognition.current.stop();
    } else {
      recognition.current.start();
      setListening(true);
    }
  }, [listening]);

  return { listening, supported, toggle };
}
