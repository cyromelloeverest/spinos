"use client";

import { redactThirdPartyData } from "@/lib/actions/admin";

export function RedactThirdPartyButton({ opportunityScoreId, personName }: { opportunityScoreId: string; personName: string }) {
  const action = redactThirdPartyData.bind(null, opportunityScoreId);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Apagar nome, e-mail e telefone de "${personName}" deste registro? A empresa/oportunidade continua, só os dados pessoais somem.`)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="text-[12px] font-semibold px-3 py-1.5 rounded-[8px] border-0 cursor-pointer flex-shrink-0"
        style={{ background: "var(--critical)", color: "#ffffff" }}
      >
        Redigir dados
      </button>
    </form>
  );
}
