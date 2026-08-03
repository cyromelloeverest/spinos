const LINKEDIN_BLUE = "#0A66C2";

function LinkedInIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function LinkedInButton({
  href,
  label = "LinkedIn",
  size = "md",
}: {
  href: string;
  label?: string;
  size?: "sm" | "md";
}) {
  const isSm = size === "sm";
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center no-underline font-semibold transition hover:brightness-110"
      style={{
        gap: isSm ? "5px" : "7px",
        background: LINKEDIN_BLUE,
        color: "#ffffff",
        borderRadius: isSm ? "999px" : "12px",
        padding: isSm ? "4px 10px" : "8px 16px",
        fontSize: isSm ? "11.5px" : "12.5px",
        boxShadow: isSm ? undefined : "0 3px 10px rgba(10,102,194,0.28)",
      }}
    >
      <LinkedInIcon size={isSm ? 12 : 14} />
      {label}
    </a>
  );
}
