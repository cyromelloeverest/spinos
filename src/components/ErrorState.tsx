"use client";

import { AlertTriangle } from "lucide-react";

type SecondaryAction = { label: string; href: string } | { label: string; onClick: () => void };

export function ErrorState({
  title,
  message,
  onRetry,
  secondaryAction,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
  secondaryAction?: SecondaryAction;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[420px] text-center">
        <div className="flex flex-col items-center gap-1.5 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-preto.svg" alt="Spinos" style={{ height: "26px", width: "auto" }} />
        </div>

        <div
          className="inline-flex items-center justify-center w-11 h-11 rounded-full mb-5"
          style={{ background: "var(--critical-soft)" }}
        >
          <AlertTriangle size={20} strokeWidth={2} style={{ color: "var(--critical)" }} />
        </div>

        <h1 className="text-[22px] font-medium m-0 mb-3" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </h1>
        <p className="text-[13.5px] leading-[1.6] mb-6" style={{ color: "var(--fg-muted)" }}>
          {message}
        </p>

        <div className="flex flex-col items-center gap-4">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-block text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border-0 cursor-pointer"
              style={{ background: "var(--primary)", color: "#ffffff" }}
            >
              Tentar novamente
            </button>
          )}

          {secondaryAction &&
            ("href" in secondaryAction ? (
              <a
                href={secondaryAction.href}
                className="text-[12.5px] no-underline"
                style={{ color: "var(--fg-faint)" }}
              >
                {secondaryAction.label}
              </a>
            ) : (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="text-[12.5px] cursor-pointer"
                style={{ background: "none", border: "none", color: "var(--fg-faint)" }}
              >
                {secondaryAction.label}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
