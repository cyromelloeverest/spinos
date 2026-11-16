import { Loader2 } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={22} strokeWidth={2} className="animate-spin" style={{ color: "var(--fg-faint)" }} />
    </div>
  );
}
