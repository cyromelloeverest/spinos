"use server";

import { redirect } from "next/navigation";
import { withOrgContext } from "@/lib/db/with-org-context";
import { suppressEmail } from "@/lib/email/audience";
import { verifyUnsubscribe } from "@/lib/email/tokens";
import { logError } from "@/lib/log-error";

export async function unsubscribeAction(formData: FormData) {
  const o = String(formData.get("o") ?? "");
  const e = String(formData.get("e") ?? "");
  const t = String(formData.get("t") ?? "");
  const email = verifyUnsubscribe(o, e, t);
  if (!email) redirect("/descadastrar");
  try {
    // A organização vem do link assinado; o contexto de organização garante que só ela é afetada.
    await withOrgContext(o, (tx) => suppressEmail(tx, o, email!, "UNSUBSCRIBE"));
  } catch (err) {
    logError("descadastrar: falha", err, { organizationId: o });
    redirect(`/descadastrar?o=${encodeURIComponent(o)}&e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`);
  }
  redirect(`/descadastrar?o=${encodeURIComponent(o)}&e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}&feito=1`);
}
