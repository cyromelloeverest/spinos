"use client";

import { useState } from "react";
import { Icon } from "../icons";

/** Copies a text to the clipboard and confirms on the button itself. */
export function CopyButton({ text, label, doneLabel }: { text: string; label: string; doneLabel: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No clipboard access (old browser, insecure page): the classic way still works.
      const area = document.createElement("textarea");
      area.value = text;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };
  return (
    <button type="button" onClick={copy} aria-live="polite" className={`kit-copy ${done ? "is-done" : ""}`}>
      <Icon name={done ? "check" : "copy"} className="size-4" strokeWidth={2} />
      {done ? doneLabel : label}
    </button>
  );
}
