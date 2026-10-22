"use client";

import { ArrowUp, Mic, MicOff, Square } from "lucide-react";
import { useLayoutEffect, type RefObject } from "react";
import { useSpeech } from "@/lib/use-speech";
import { cn } from "@/lib/utils";

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const speech = useSpeech((text, final) => {
    onChange(text);
    if (final) inputRef.current?.focus();
  });
  const canSend = !busy && value.trim().length >= 2;

  // Grow with the text up to the CSS max-height, then scroll inside.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, inputRef]);

  return (
    <form
      className="ask-comp"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSend();
      }}
    >
      <div className={cn("cbox", speech.listening && "is-listen")}>
        <textarea
          ref={inputRef}
          className="cin"
          rows={1}
          value={value}
          maxLength={1000}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && busy) {
              e.preventDefault();
              onStop();
              return;
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder={speech.listening ? "Listening..." : "Ask about units, topics, credits..."}
          aria-label="Ask a question about this syllabus"
          enterKeyHint="send"
        />
        {speech.supported && (
          <button
            type="button"
            className="icon-btn"
            onClick={speech.toggle}
            aria-label={speech.listening ? "Stop voice input" : "Ask with your voice"}
            aria-pressed={speech.listening}
            title={speech.listening ? "Stop voice input" : "Ask with your voice"}
            style={speech.listening ? { color: "var(--danger)" } : undefined}
          >
            {speech.listening ? <MicOff className="i i-s" /> : <Mic className="i i-s" />}
          </button>
        )}
        {busy ? (
          <button type="button" className="send ask-stop" onClick={onStop} aria-label="Stop answering" title="Stop">
            <Square className="i i-s" fill="currentColor" />
          </button>
        ) : (
          <button type="submit" className="send" disabled={!canSend} aria-label="Send question">
            <ArrowUp className="i" />
          </button>
        )}
      </div>
      <p className="ask-comp-hint">
        <span className="ask-hide-touch">
          <kbd className="kbd">Enter</kbd> to send, <kbd className="kbd">Shift</kbd> + <kbd className="kbd">Enter</kbd> for a new line.{" "}
        </span>
        Answers come only from this PDF.
      </p>
    </form>
  );
}
