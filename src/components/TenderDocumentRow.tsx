"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Download } from "lucide-react";
import { removeTenderDocument } from "@/lib/actions/licitacoes-documentos";

export function TenderDocumentActions({ tenderId, documentId, fileName }: { tenderId: string; documentId: string; fileName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(`Remover "${fileName}"? O arquivo e o texto extraído serão apagados.`)) return;
    setBusy(true);
    const r = await removeTenderDocument(tenderId, documentId);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <a href={`/licitacoes/${tenderId}/documentos/${documentId}/download`} aria-label={`Baixar ${fileName}`} className="p-1" style={{ color: "var(--fg-muted)" }}>
        <Download size={15} strokeWidth={1.75} />
      </a>
      <button type="button" onClick={remove} disabled={busy} aria-label={`Remover ${fileName}`} className="cursor-pointer border-0 bg-transparent p-1" style={{ color: "var(--fg-faint)" }}>
        <Trash2 size={15} strokeWidth={1.75} />
      </button>
      {error && <span className="text-[11.5px]" style={{ color: "var(--critical)" }}>{error}</span>}
    </div>
  );
}
