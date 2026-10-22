"use client";

import { CheckCircle2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) {
      setState("sent");
    } else {
      const data = await res.json();
      toast.error(data.error === "Invalid input" ? "Please check your name, email and message (min 10 characters)." : data.error);
      setState("idle");
    }
  };

  if (state === "sent") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <CheckCircle2 className="size-12 text-success" />
          <p className="font-display text-xl font-semibold">Message sent!</p>
          <p className="text-sm text-muted-foreground">Thanks {form.name.split(" ")[0]}, the team will get back to you soon.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Name</Label>
              <Input id="c-name" required minLength={2} maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-msg">Message</Label>
            <Textarea id="c-msg" required minLength={10} maxLength={3000} rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
          <Button type="submit" size="lg" disabled={state === "sending"}>
            {state === "sending" ? <><Spinner size={16} /> Sending...</> : <><Send className="size-4" /> Send message</>}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
