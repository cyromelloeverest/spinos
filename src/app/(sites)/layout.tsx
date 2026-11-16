import "./sites.css";

// Raiz dos sites públicos dos clientes: um documento próprio, sem nada da plataforma
// (nem o CSS dela). O tema, a língua e as fontes de cada site vêm do layout de dentro,
// que conhece o domínio.
export default function SitesRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
