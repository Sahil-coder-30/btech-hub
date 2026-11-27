"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

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

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const subscribeSpeechSupport = () => () => {
  // Browser SpeechRecognition support is static for the lifetime of the page.
};

const getSpeechSupport = () =>
  typeof window !== "undefined" && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);

/** Voice input through the browser's free speech recognition (Chrome, Edge, Safari). */
export function useSpeech(onText: (text: string, final: boolean) => void) {
  const [listening, setListening] = useState(false);
  const supported = useSyncExternalStore(subscribeSpeechSupport, getSpeechSupport, () => false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const callback = useRef(onText);

  useEffect(() => {
    callback.current = onText;
  }, [onText]);

  useEffect(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
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
