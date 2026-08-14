import { Radar } from "lucide-react";

// Mesma animação do hero de spinos.com.br (site institucional, hospedado
// separado no Hostinger — reimplementada aqui a partir do DOM/CSS reais do
// site, não copiada de código-fonte compartilhado). Círculos concêntricos +
// pulso central + pontos "piscando" simulam uma varredura de radar
// encontrando sinais, o mesmo conceito do produto (varrer sinais públicos).
export function RadarAnimation({
  size = 280,
  label,
}: {
  size?: number;
  label?: string;
}) {
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
        style={{ background: "conic-gradient(from 0deg, transparent 0deg, rgba(37,99,235,0.16) 70deg, transparent 140deg)" }}
      />
      <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <circle cx="200" cy="200" r="188" fill="none" stroke="var(--border)" strokeWidth="1" />
        <circle cx="200" cy="200" r="136" fill="none" stroke="var(--border)" strokeWidth="1" />
        <circle cx="200" cy="200" r="84" fill="none" stroke="var(--border)" strokeWidth="1" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="absolute w-20 h-20 rounded-full animate-radar-pulse" style={{ background: "var(--primary)" }} />
        <span
          className="absolute w-20 h-20 rounded-full animate-radar-pulse"
          style={{ background: "var(--primary)", animationDelay: "1.5s" }}
        />
        <div
          className="relative w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "var(--primary)", boxShadow: "0 0 0 10px var(--primary-soft)" }}
        >
          <Radar size={26} strokeWidth={1.75} color="#ffffff" aria-hidden="true" />
        </div>
      </div>
      {dots.map((dot, i) => (
        <div key={i} className="absolute" style={{ top: dot.top, left: dot.left }}>
          <span
            className="block w-2.5 h-2.5 rounded-full animate-ping-dot"
            style={{ background: "var(--primary)", animationDelay: dot.delay }}
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
