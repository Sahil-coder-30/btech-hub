"use client";

import { Camera, ImagePlus, Mic, MicOff, SendHorizontal, X } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { AttachedImage } from "./studio-shared";

export function StudioComposer({
  input,
  loading,
  listening,
  speechSupported,
  attachment,
  textareaRef,
  onInputChange,
  onSubmit,
  onToggleSpeech,
  onAttachFile,
  onRemoveAttachment,
}: {
  input: string;
  loading: boolean;
  listening: boolean;
  speechSupported: boolean;
  attachment: AttachedImage | null;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  onToggleSpeech: () => void;
  onAttachFile: (file: File | undefined) => void;
  onRemoveAttachment: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canSend = (Boolean(input.trim()) || Boolean(attachment)) && !loading;

  return (
    <div className="composer">
      {attachment && (
        <div className="mx-auto mb-2 flex max-w-[780px] items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2">
          <img src={attachment.previewUrl} alt={attachment.fileName} className="size-11 rounded-lg border border-border object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{attachment.fileName}</p>
            <p className="text-[11px] text-muted-foreground">Ready to solve with your message</p>
          </div>
          <button
            type="button"
            className="icon-btn sm"
            onClick={onRemoveAttachment}
            aria-label="Remove attached photo"
            title="Remove photo"
          >
            <X className="i i-s" aria-hidden />
          </button>
        </div>
      )}

      <form
        className={cn("cbox", listening && "is-listen")}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/heic"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            onAttachFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="icon-btn mb-0.5"
          aria-label="Attach or snap question photo"
          title="Attach question photo (or paste / drop)"
          onClick={() => fileRef.current?.click()}
        >
          {attachment ? <Camera className="i i-s text-primary" aria-hidden /> : <ImagePlus className="i i-s" aria-hidden />}
        </button>

        {listening ? (
          <div className="flex flex-1 items-center gap-3 px-1.5 py-2">
            <div className="wave" aria-hidden="true">
              <i style={{ animationDelay: "0s" }} />
              <i style={{ animationDelay: ".1s" }} />
              <i style={{ animationDelay: ".2s" }} />
              <i style={{ animationDelay: ".3s" }} />
              <i style={{ animationDelay: ".15s" }} />
              <i style={{ animationDelay: ".05s" }} />
              <i style={{ animationDelay: ".25s" }} />
            </div>
            <span className="text-sm font-medium text-danger">Listening, speak your question</span>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            className="cin"
            rows={1}
            value={input}
            onChange={onInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder={attachment ? "Add optional instructions for this photo..." : "Ask Vac anything or paste a question photo..."}
            aria-label="Ask Vac"
            autoComplete="off"
          />
        )}

        {speechSupported && (
          <button
            type="button"
            className="icon-btn mb-0.5"
            aria-label={listening ? "Stop voice input" : "Speak your question"}
            aria-pressed={listening}
            onClick={onToggleSpeech}
            style={{ color: listening ? "var(--danger)" : undefined }}
          >
            {listening ? <MicOff className="i i-s" aria-hidden /> : <Mic className="i i-s" aria-hidden />}
          </button>
        )}

        <button type="submit" className="send mb-0.5" aria-label="Send message" disabled={!canSend}>
          <SendHorizontal className="size-4" aria-hidden />
        </button>
      </form>
      <p className="mt-2 text-center text-xs text-muted-foreground">Drop or paste a photo anytime. Verify important dates on aktu.ac.in.</p>
    </div>
  );
}
