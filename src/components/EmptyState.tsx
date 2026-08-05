export function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-[10px] border border-dashed p-6 text-[13px] text-center"
      style={{ borderColor: "var(--border)", color: "var(--fg-faint)" }}
    >
      {message}
    </div>
  );
}
