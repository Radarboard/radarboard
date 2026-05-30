"use client";

import { type FormEvent, useCallback, useState } from "react";

type WaitlistState = "idle" | "loading" | "success" | "error";

export function useWaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<WaitlistState>("idle");
  const [message, setMessage] = useState("");

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (state === "loading" || state === "success") return;

      setState("loading");
      try {
        const res = await fetch("/api/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setState("success");
          setMessage(data.message);
        } else {
          setState("error");
          setMessage(data.message ?? "Something went wrong");
        }
      } catch {
        setState("error");
        setMessage("Network error. Please try again.");
      }
    },
    [email, state]
  );

  return { email, setEmail, state, message, submit } as const;
}
