"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { requestTenderUpload, finalizeTenderUpload } from "@/lib/actions/licitacoes-documentos";

const MAX_BYTES = 50 * 1024 * 1024;

const KIND_OPTIONS = [
  ["EDITAL", "Edital"],
  ["TERMO_REFERENCIA", "Termo de referência"],
  ["ANEXO", "Anexo"],
  ["RETIFICACAO", "Retificação"],
  ["ESCLARECIMENTO", "Esclarecimento"],
  ["COMPROVANTE", "Comprovante"],
  ["OUTRO", "Outro"],
] as const;

export function TenderUpload({ tenderId }: { tenderId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("EDITAL");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  async function send() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setMessage({ type: "error", text: "Escolha um arquivo PDF." });
    if (file.size > MAX_BYTES) return setMessage({ type: "error", text: "O arquivo passa de 50 MB." });
    if (!file.name.toLowerCase().endsWith(".pdf")) return setMessage({ type: "error", text: "Envie um arquivo .pdf." });

    setBusy(true);
    setMessage(null);
    try {
      const slot = await requestTenderUpload(tenderId, file.size);
      if (!slot.ok) return setMessage({ type: "error", text: slot.error });

      const { error } = await createClient().storage.from("licitacoes").uploadToSignedUrl(slot.path, slot.token, file, { contentType: "application/pdf" });
      if (error) return setMessage({ type: "error", text: "Falha no envio do arquivo. Tente novamente." });

      setMessage({ type: "ok", text: "Arquivo enviado. Verificando e extraindo o texto…" });
      const done = await finalizeTenderUpload(tenderId, slot.path, file.name, kind);
      if (!done.ok) return setMessage({ type: "error", text: done.error });

      setMessage({
        type: "ok",
        text:
          done.extraction === "SEM_TEXTO"
            ? "Documento registrado, mas não foi possível extrair texto (provavelmente é um PDF escaneado). A análise por IA depende de texto."
            : `Documento registrado (${done.pageCount} página(s)).`,
      });
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Algo deu errado. Tente novamente." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[16px] border p-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="flex flex-col gap-1.5 md:w-[220px]">
          <span className="text-[12.5px] font-medium">Tipo</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded-[10px] border px-3 text-[13.5px] outline-none"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)", height: "44px" }}
          >
            {KIND_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className="text-[12.5px] font-medium">Arquivo PDF (até 50 MB)</span>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="text-[13px]" />
        </label>
        <button
          type="button"
          onClick={send}
          disabled={busy}
          className="text-[13px] font-semibold px-4 py-2 rounded-[10px] border cursor-pointer"
          style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff", opacity: busy ? 0.6 : 1, height: "44px" }}
        >
          {busy ? "Enviando…" : "Enviar"}
        </button>
      </div>
      {message && (
        <div className="mt-3 text-[12.5px]" style={{ color: message.type === "ok" ? "var(--primary)" : "var(--critical)" }} role="status">
          {message.text}
        </div>
      )}
      <p className="text-[11.5px] leading-[1.5] m-0 mt-3" style={{ color: "var(--fg-faint)" }}>
        O arquivo é guardado em área privada da sua organização. O conteúdo do edital é tratado apenas como dado a ser analisado.
      </p>
    </div>
  );
}
