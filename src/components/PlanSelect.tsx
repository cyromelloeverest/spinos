"use client";

import { useRef } from "react";
import { updateOrganizationPlan } from "@/lib/actions/admin";
import { PLANS } from "@/lib/plans";

export function PlanSelect({ organizationId, currentPlan }: { organizationId: string; currentPlan: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = updateOrganizationPlan.bind(null, organizationId);

  return (
    <form ref={formRef} action={action}>
      <select
        name="plan"
        defaultValue={currentPlan}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-[8px] border px-2.5 py-1.5 text-[12.5px] outline-none"
        style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }}
      >
        {Object.values(PLANS).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </form>
  );
}
