"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { startMfaEnrollment, confirmMfaEnrollment, unenrollMfaFactor } from "@/lib/actions/mfa";

type Step = "idle" | "enrolling" | "confirming";

export function MfaSettings({ hasMfa, factorId }: { hasMfa: boolean; factorId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [newFactorId, setNewFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleEnroll() {
    setError(null);
    startTransition(async () => {
      const result = await startMfaEnrollment();
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setQrCode(result.qrCode);
      setSecret(result.secret);
      setNewFactorId(result.factorId);
      setStep("confirming");
    });
  }

  function handleConfirm() {
    if (!newFactorId) return;
    setError(null);
    startTransition(async () => {
      const result = await confirmMfaEnrollment(newFactorId, code);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setStep("idle");
      setQrCode(null);
      setSecret(null);
      setCode("");
      router.refresh();
    });
  }

  function handleUnenroll() {
    if (!factorId) return;
    setError(null);
    startTransition(async () => {
      const result = await unenrollMfaFactor(factorId);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  if (hasMfa) {
    return (
      <div
        className="rounded-[16px] border p-4 flex items-center justify-between gap-4 flex-wrap"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--good-soft)", color: "var(--good)" }}
          >
            <ShieldCheck size={17} strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-[13.5px] font-semibold">Autenticação em duas etapas ativada</div>
            <div className="text-[12px] mt-0.5" style={{ color: "var(--fg-muted)" }}>
              Seu login pede um código do app autenticador, além da senha.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleUnenroll}
          disabled={pending}
          className="text-[13px] font-semibold px-4 py-2 rounded-[10px] border cursor-pointer flex-shrink-0"
          style={{ background: "var(--card)", borderColor: "var(--critical)", color: "var(--critical)", opacity: pending ? 0.6 : 1 }}
        >
          Desativar
        </button>
        {error && (
          <div className="w-full text-[12px]" style={{ color: "var(--critical)" }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  if (step === "confirming" && qrCode) {
    return (
      <div className="rounded-[16px] border p-5 flex flex-col gap-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div>
          <div className="text-[13.5px] font-semibold mb-1">Escaneie o código com seu app autenticador</div>
          <p className="text-[12.5px] m-0" style={{ color: "var(--fg-muted)" }}>
            Google Authenticator, Authy, 1Password ou qualquer app compatível com TOTP.
          </p>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrCode} alt="QR code para configurar o autenticador" width={180} height={180} style={{ alignSelf: "center" }} />

        {secret && (
          <div className="text-center">
            <div className="text-[11px] uppercase mb-1" style={{ color: "var(--fg-faint)", letterSpacing: "0.06em" }}>
              Não consegue escanear? Digite o código manualmente
            </div>
            <div
              className="inline-block text-[12.5px] rounded-[8px] border px-3 py-1.5"
              style={{ fontFamily: "var(--font-mono)", borderColor: "var(--border)", color: "var(--fg-muted)" }}
            >
              {secret}
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium" style={{ color: "var(--fg)" }}>
            Código de 6 dígitos
          </span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
            className="rounded-[10px] border px-3.5 text-[18px] text-center outline-none"
            style={{
              background: "var(--bg)",
              borderColor: "var(--border)",
              color: "var(--fg)",
              height: "44px",
              letterSpacing: "0.3em",
              fontFamily: "var(--font-mono)",
            }}
          />
        </label>

        {error && <div className="text-[12px]" style={{ color: "var(--critical)" }}>{error}</div>}

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending || code.length !== 6}
            className="text-[13px] font-semibold px-5 py-2.5 rounded-[12px] border cursor-pointer"
            style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff", opacity: pending || code.length !== 6 ? 0.6 : 1 }}
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("idle");
              setQrCode(null);
              setSecret(null);
              setCode("");
              setError(null);
            }}
            className="text-[13px] font-semibold px-4 py-2.5 rounded-[12px] border cursor-pointer"
            style={{ background: "var(--card)", borderColor: "var(--border-strong)", color: "var(--fg)" }}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-[16px] border p-4 flex items-center justify-between gap-4 flex-wrap"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--card-hover)", color: "var(--fg-faint)" }}
        >
          <ShieldOff size={17} strokeWidth={1.75} />
        </div>
        <div>
          <div className="text-[13.5px] font-semibold">Autenticação em duas etapas desativada</div>
          <div className="text-[12px] mt-0.5" style={{ color: "var(--fg-muted)" }}>
            Adicione uma camada extra de segurança ao seu login.
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleEnroll}
        disabled={pending}
        className="text-[13px] font-semibold px-4 py-2 rounded-[10px] border cursor-pointer flex-shrink-0"
        style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff", opacity: pending ? 0.6 : 1 }}
      >
        Ativar
      </button>
      {error && (
        <div className="w-full text-[12px]" style={{ color: "var(--critical)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
