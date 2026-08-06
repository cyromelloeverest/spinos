"use client";

import { confirmOrganizationDeletion } from "@/lib/actions/admin";

export function ConfirmDeleteOrgButton({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const action = confirmOrganizationDeletion.bind(null, organizationId);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Excluir permanentemente "${organizationName}" e todos os seus dados? Isso não pode ser desfeito.`)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="text-[12px] font-semibold px-3 py-1.5 rounded-[8px] border-0 cursor-pointer flex-shrink-0"
        style={{ background: "var(--critical)", color: "#ffffff" }}
      >
        Confirmar exclusão
      </button>
    </form>
  );
}
