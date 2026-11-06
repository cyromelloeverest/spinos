import { FormField } from "@/components/FormField";
import { TextAreaField } from "@/components/TextAreaField";
import { toBrasiliaInput } from "@/lib/licitacoes/tender-input";

type TenderValues = {
  agency?: string;
  object?: string;
  editalNumber?: string | null;
  processNumber?: string | null;
  modality?: string | null;
  city?: string | null;
  state?: string | null;
  estimatedValue?: number | null;
  opensAt?: Date | null;
  questionsDeadline?: Date | null;
  sourcePortal?: string | null;
  officialUrl?: string | null;
  notes?: string | null;
};

const inputStyle = { background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)", height: "44px" } as const;

function DateTimeField({ label, name, value }: { label: string; name: string; value: Date | null | undefined }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium">{label}</span>
      <input type="datetime-local" name={name} defaultValue={toBrasiliaInput(value ?? null)} className="rounded-[10px] border px-3.5 text-[13.5px] outline-none" style={inputStyle} />
      <span className="text-[11.5px]" style={{ color: "var(--fg-faint)" }}>Horário de Brasília.</span>
    </label>
  );
}

export function TenderForm({ action, values = {}, submitLabel }: { action: (formData: FormData) => Promise<void>; values?: TenderValues; submitLabel: string }) {
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <FormField label="Órgão contratante" name="agency" required defaultValue={values.agency} />
      </div>
      <div className="md:col-span-2">
        <TextAreaField label="Objeto" name="object" rows={3} defaultValue={values.object} hint="Descreva o objeto como consta no edital." />
      </div>
      <FormField label="Número do edital" name="editalNumber" defaultValue={values.editalNumber ?? ""} />
      <FormField label="Número do processo" name="processNumber" defaultValue={values.processNumber ?? ""} />
      <FormField label="Modalidade" name="modality" defaultValue={values.modality ?? ""} placeholder="Ex.: Pregão eletrônico" />
      <FormField label="Valor estimado (R$)" name="estimatedValue" defaultValue={values.estimatedValue != null ? String(values.estimatedValue).replace(".", ",") : ""} />
      <FormField label="Cidade" name="city" defaultValue={values.city ?? ""} />
      <FormField label="UF" name="state" defaultValue={values.state ?? ""} placeholder="SP" />
      <DateTimeField label="Abertura da sessão" name="opensAt" value={values.opensAt} />
      <DateTimeField label="Prazo para esclarecimentos" name="questionsDeadline" value={values.questionsDeadline} />
      <FormField label="Portal" name="sourcePortal" defaultValue={values.sourcePortal ?? ""} placeholder="Ex.: ComprasGov, BLL, Licitanet" />
      <FormField label="Link oficial" name="officialUrl" defaultValue={values.officialUrl ?? ""} placeholder="https://" />
      <div className="md:col-span-2">
        <TextAreaField label="Observações" name="notes" rows={3} defaultValue={values.notes ?? ""} />
      </div>
      <div className="md:col-span-2">
        <button type="submit" className="text-[13px] font-semibold px-4 py-2 rounded-[10px] border cursor-pointer" style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "#ffffff" }}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
