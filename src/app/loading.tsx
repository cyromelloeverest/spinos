import { Loader2 } from "lucide-react";

export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <Loader2 size={22} strokeWidth={2} className="animate-spin" style={{ color: "var(--fg-faint)" }} />
    </div>
  );
}
