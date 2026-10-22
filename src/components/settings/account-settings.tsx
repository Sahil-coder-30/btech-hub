"use client";

import { ArrowUpRight, BadgeCheck, Check, Copy, LogOut, RotateCcw, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-context";
import { GoogleIcon } from "@/components/landing/google-icon";
import { SettingRow, SettingsHeader, SettingsSection } from "@/components/settings/primitives";
import { Spinner } from "@/components/ui/misc";
import type { AccountInfo } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const NAME_MAX = 60;

const errorOf = async (res: Response | null) =>
  res ? (((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Something went wrong. Please try again.") : "Network error. Check your connection.";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "S";

/** Google photo with an initials fallback when there is no photo or it fails to load. */
function Avatar({ src, name, size = 64 }: { src: string | null; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Google avatars are external and tiny, next/image adds nothing here
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        style={style}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full border border-border object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      style={style}
      className="grid shrink-0 place-items-center rounded-full bg-[var(--primary-soft)] text-lg font-semibold text-[var(--primary-text)]"
    >
      {initialsOf(name)}
    </span>
  );
}

/** Account tab: name, photo, email, role and sign out. */
export function AccountSettings({ initial }: { initial: AccountInfo }) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [account, setAccount] = useState(initial);

  // ---------- Display name ----------
  const [name, setName] = useState(initial.displayName ?? "");
  const [savingName, setSavingName] = useState(false);
  const [announce, setAnnounce] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);

  const saved = account.displayName ?? "";
  const trimmed = name.trim();
  const dirty = trimmed !== saved;
  const tooLong = trimmed.length > NAME_MAX;
  // An empty box means "use my Google name", which is a valid save
  const canSave = dirty && !tooLong && !savingName;

  const saveName = async (value: string | null) => {
    setSavingName(true);
    setAnnounce("Saving your name");
    // Typing the Google name again is the same as clearing the custom one
    const displayName = value && value !== account.googleName ? value : null;
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    }).catch(() => null);
    setSavingName(false);

    if (!res?.ok) {
      const error = await errorOf(res);
      setAnnounce(`Not saved. ${error}`);
      toast.error("Could not save your name", { description: error });
      return;
    }
    const data = (await res.json()) as { account: AccountInfo };
    setAccount(data.account);
    setName(data.account.displayName ?? "");
    setAnnounce("Name saved");
    toast.success(data.account.displayName ? "Name updated" : "Using your Google name");
    // The session cookie was re-signed, so the navbar picks up the new name
    void refresh();
    router.refresh();
  };

  const submitName = (event: FormEvent) => {
    event.preventDefault();
    if (canSave) void saveName(trimmed || null);
  };

  const cancelName = () => {
    setName(saved);
    nameInput.current?.focus();
  };

  // ---------- Email copy ----------
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(account.email);
      setCopied(true);
      toast.success("Email copied");
    } catch {
      toast.error("Could not copy. Select the email and copy it by hand.");
    }
  };

  // ---------- Sign out ----------
  const [signingOut, setSigningOut] = useState(false);
  const signOut = async () => {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    // Full reload so no signed-in state survives in memory
    window.location.replace("/");
  };

  const isAdmin = account.role === "admin";

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Account"
        description="Your name, photo and how you sign in."
        action={
          <Link href="/profile" className="btn btn-secondary btn-sm">
            View my profile <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        }
      />

      <SettingsSection title="Profile" description="How you appear across B.Tech Hub and to Vac." icon={UserRound} accent="violet">
        <div className="flex items-center gap-4 py-4">
          <Avatar src={account.avatarUrl} name={account.name} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <span className="truncate text-base font-semibold">{account.name}</span>
              {isAdmin ? (
                <span className="chip chip-p">
                  <ShieldCheck className="size-3.5" aria-hidden /> Admin
                </span>
              ) : (
                <span className="chip chip-n">Student</span>
              )}
            </p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{account.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">Your photo comes from your Google account.</p>
          </div>
        </div>

        <form onSubmit={submitName} className="py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label htmlFor="display-name" className="text-sm font-medium">
              Display name
            </label>
            <span className={cn("text-xs tabular-nums", tooLong ? "text-[var(--danger)]" : "text-muted-foreground")} aria-hidden>
              {trimmed.length}/{NAME_MAX}
            </span>
          </div>
          <p id="display-name-help" className="mt-0.5 text-[13px] text-muted-foreground">
            {account.googleName ? (
              <>
                Leave it empty to use your Google name, <span className="font-medium text-foreground">{account.googleName}</span>.
              </>
            ) : (
              "Shown in the navbar, on your profile and when Vac talks to you."
            )}
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={nameInput}
              id="display-name"
              className="input sm:max-w-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && dirty) {
                  e.preventDefault();
                  cancelName();
                }
              }}
              placeholder={account.googleName ?? "Your name"}
              maxLength={NAME_MAX + 20}
              autoComplete="name"
              aria-invalid={tooLong || undefined}
              aria-describedby="display-name-help display-name-status"
              disabled={savingName}
            />
            {/* Fixed-height slot so the buttons never push the row around */}
            <div className="flex h-[34px] items-center gap-2">
              {dirty ? (
                <>
                  <button type="submit" className="btn btn-primary btn-sm disabled:opacity-50" disabled={!canSave}>
                    {savingName && <Spinner size={14} />}
                    {savingName ? "Saving..." : "Save"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={cancelName} disabled={savingName}>
                    Cancel
                  </button>
                </>
              ) : (
                account.displayName &&
                account.googleName && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => void saveName(null)} disabled={savingName}>
                    <RotateCcw className="size-3.5" aria-hidden /> Use Google name
                  </button>
                )
              )}
            </div>
          </div>
          <p id="display-name-status" className="mt-1.5 min-h-[18px] text-xs text-[var(--danger)]" aria-live="polite">
            {tooLong ? `Keep it under ${NAME_MAX} characters.` : <span className="sr-only">{announce}</span>}
          </p>
        </form>

        <SettingRow
          label="Email"
          description={
            <span className="inline-flex items-center gap-1.5">
              <GoogleIcon size={13} /> Signed in with Google. Change it in your Google account.
            </span>
          }
        >
          <span className="max-w-[220px] truncate font-mono text-[13px] sm:max-w-[260px]" title={account.email}>
            {account.email}
          </span>
          <button type="button" className="icon-btn" onClick={copyEmail} aria-label={copied ? "Email copied" : "Copy email"}>
            {copied ? <Check className="size-4 text-[var(--success)]" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          </button>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Account details" icon={BadgeCheck} accent="blue">
        <SettingRow label="Role" description={isAdmin ? "You can manage resources, uploads and the syllabus index." : "Full access to every study tool."}>
          {isAdmin ? (
            <span className="chip chip-p">
              <ShieldCheck className="size-3.5" aria-hidden /> Admin
            </span>
          ) : (
            <span className="chip chip-n">Student</span>
          )}
        </SettingRow>
        <SettingRow label="Member since">
          <time dateTime={account.createdAt} className="text-sm tabular-nums">
            {formatDate(account.createdAt)}
          </time>
        </SettingRow>
        <SettingRow
          label="Study profile"
          description={account.onboarded ? "Vac uses your result, semester and goals to tailor advice." : "Finish setup so Vac can give advice that fits you."}
        >
          {account.onboarded ? (
            <>
              <span className="chip chip-s">
                <Check className="size-3.5" aria-hidden /> Set up
              </span>
              <Link href="/onboarding?redo=1&next=/settings/account" className="btn btn-ghost btn-sm">
                Update result
              </Link>
            </>
          ) : (
            <>
              <span className="chip chip-w">Not finished</span>
              <Link href="/onboarding?next=/settings/account" className="btn btn-primary btn-sm">
                Finish setup
              </Link>
            </>
          )}
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Session" icon={LogOut} accent="amber">
        <SettingRow label="Sign out" description="Sign out of B.Tech Hub on this device.">
          <button type="button" className="btn btn-secondary btn-sm" onClick={signOut} disabled={signingOut}>
            {signingOut ? <Spinner size={14} /> : <LogOut className="size-4" aria-hidden />}
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </SettingRow>
      </SettingsSection>
    </div>
  );
}
