export function TextAreaField({
  label,
  name,
  placeholder,
  hint,
  defaultValue,
  rows = 4,
}: {
  label: string;
  name: string;
  placeholder?: string;
  hint?: string;
  defaultValue?: string;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>
        {label}
      </span>
      <textarea
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        rows={rows}
        className="rounded-[10px] border px-3.5 py-3 text-[13.5px] outline-none resize-y"
        style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }}
      />
      {hint && (
        <span className="text-[12px] leading-[1.45]" style={{ color: "var(--fg-muted)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}
