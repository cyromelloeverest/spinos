export function FormField({
  label,
  name,
  placeholder,
  required,
  hint,
  defaultValue,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium" style={{ color: "var(--fg)" }}>
        {label}
        {required && <span style={{ color: "var(--copper)" }}> *</span>}
      </span>
      <input
        name={name}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        className="rounded-[8px] border px-3 py-2.5 text-[13.5px] outline-none"
        style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--fg)" }}
      />
      {hint && (
        <span className="text-[11.5px]" style={{ color: "var(--fg-faint)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}
