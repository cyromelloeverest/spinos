// O Spinos Score é o norte do produto — a métrica que resume o quanto uma
// empresa está pronta pra comprar agora. Um único componente cobre todas as
// telas onde ele aparece (dashboard, lista de oportunidades, detalhe da
// empresa, histórico, assistente de vendas, pipeline) pra manter a mesma
// linguagem visual em todo lugar em vez de seis badges levemente diferentes.

type SpinosScoreVariant = "hero" | "card" | "compact" | "inline";

type Tier = { bg: string; fg: string; border: string; ring: string };

function tierOf(value: number): Tier {
  if (value >= 85) return { bg: "var(--primary)", fg: "#ffffff", border: "var(--primary)", ring: "var(--primary)" };
  if (value >= 60) return { bg: "var(--primary-soft)", fg: "var(--primary)", border: "var(--primary-line)", ring: "var(--primary)" };
  return { bg: "var(--card-hover)", fg: "var(--fg-muted)", border: "var(--border)", ring: "var(--border-strong)" };
}

const BADGE_CONFIG: Record<"card" | "compact", { box: number; font: number; radius: number }> = {
  card: { box: 64, font: 27, radius: 16 },
  compact: { box: 44, font: 17, radius: 12 },
};

export function SpinosScore({ value, variant = "card" }: { value: number; variant?: SpinosScoreVariant }) {
  if (variant === "hero") return <ScoreHero value={value} />;
  if (variant === "inline") return <ScoreInline value={value} />;
  return <ScoreBadge value={value} variant={variant} />;
}

function ScoreBadge({ value, variant }: { value: number; variant: "card" | "compact" }) {
  const config = BADGE_CONFIG[variant];
  const tier = tierOf(value);
  return (
    <div
      className="flex items-center justify-center font-bold flex-shrink-0"
      style={{
        width: config.box,
        height: config.box,
        borderRadius: config.radius,
        fontFamily: "var(--font-mono)",
        fontVariantNumeric: "tabular-nums",
        fontSize: config.font,
        letterSpacing: "-0.02em",
        background: tier.bg,
        color: tier.fg,
        border: `1px solid ${tier.border}`,
      }}
    >
      {value}
    </div>
  );
}

function ScoreInline({ value }: { value: number }) {
  const tier = tierOf(value);
  return (
    <span
      className="inline-flex items-center font-bold flex-shrink-0"
      style={{
        fontFamily: "var(--font-mono)",
        fontVariantNumeric: "tabular-nums",
        fontSize: 11,
        lineHeight: "16px",
        padding: "0 6px",
        borderRadius: 999,
        background: tier.bg,
        color: tier.fg,
        letterSpacing: "-0.01em",
      }}
    >
      {value}
    </span>
  );
}

function ScoreHero({ value }: { value: number }) {
  const size = 112;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - clamped / 100);
  const tier = tierOf(value);

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={tier.ring}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center font-bold"
          style={{
            fontFamily: "var(--font-mono)",
            fontVariantNumeric: "tabular-nums",
            fontSize: 34,
            letterSpacing: "-0.03em",
            color: "var(--fg)",
          }}
        >
          {value}
        </div>
      </div>
      <div className="text-[11px] font-semibold uppercase" style={{ color: "var(--fg-faint)", letterSpacing: "0.08em" }}>
        Spinos Score
      </div>
    </div>
  );
}
