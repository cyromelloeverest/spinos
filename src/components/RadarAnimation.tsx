import { Radar } from "lucide-react";

// Mesma animação do hero de spinos.com.br (site institucional, hospedado
// separado no Hostinger — reimplementada aqui a partir do DOM/CSS reais do
// site, não copiada de código-fonte compartilhado). Círculos concêntricos +
// pulso central + pontos "piscando" simulam uma varredura de radar
// encontrando sinais, o mesmo conceito do produto (varrer sinais públicos).
// Proporções calculadas a partir do tamanho original do site (420px) — o
// site usa valores fixos em px porque só aparece num tamanho; aqui precisa
// escalar (ex: 140px no estado vazio de Oportunidades, mais discreto).
export function RadarAnimation({
  size = 200,
  label,
}: {
  size?: number;
  label?: string;
}) {
  const pulseSize = size * (80 / 420);
  const centerSize = size * (64 / 420);
  const ringSpread = size * (10 / 420);
  const dotSize = Math.max(size * (10 / 420), 6);
  const iconSize = size * (26 / 420);

  const dots = [
    { top: "18%", left: "62%", delay: "0s", label },
    { top: "68%", left: "22%", delay: "0.6s" },
    { top: "30%", left: "20%", delay: "1.2s" },
    { top: "76%", left: "70%", delay: "1.8s" },
  ];

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full animate-[spin_7s_linear_infinite]"
        style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(37,99,235,0.12) 70deg, transparent 140deg)" }}
      />
      <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <circle cx="200" cy="200" r="188" fill="none" stroke="var(--border)" strokeWidth="1" />
        <circle cx="200" cy="200" r="136" fill="none" stroke="var(--border)" strokeWidth="1" />
        <circle cx="200" cy="200" r="84" fill="none" stroke="var(--border)" strokeWidth="1" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="absolute rounded-full animate-radar-pulse"
          style={{ width: pulseSize, height: pulseSize, background: "var(--primary)" }}
        />
        <span
          className="absolute rounded-full animate-radar-pulse"
          style={{ width: pulseSize, height: pulseSize, background: "var(--primary)", animationDelay: "1.5s" }}
        />
        <div
          className="relative rounded-full flex items-center justify-center"
          style={{
            width: centerSize,
            height: centerSize,
            background: "var(--primary)",
            boxShadow: `0 0 0 ${ringSpread}px var(--primary-soft)`,
          }}
        >
          <Radar size={iconSize} strokeWidth={1.75} color="#ffffff" aria-hidden="true" />
        </div>
      </div>
      {dots.map((dot, i) => (
        <div key={i} className="absolute" style={{ top: dot.top, left: dot.left }}>
          <span
            className="block rounded-full animate-ping-dot"
            style={{ width: dotSize, height: dotSize, background: "var(--primary)", animationDelay: dot.delay }}
          />
          {dot.label && (
            <div
              className="absolute left-1/2 -translate-x-1/2 mt-2.5 whitespace-nowrap flex items-center gap-1.5 rounded-full pl-1.5 pr-3 py-1 text-[11px] font-semibold"
              style={{ background: "var(--card)", color: "var(--fg)", boxShadow: "var(--shadow-card)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--primary)" }} />
              {dot.label}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
