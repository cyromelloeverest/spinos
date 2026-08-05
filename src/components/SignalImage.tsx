"use client";

import { useState, type CSSProperties } from "react";

// Foto real da fonte do sinal (og:image), com fallback gracioso: se a URL
// não carregar (site removeu a imagem, bloqueou hotlink, etc.) o componente
// simplesmente some em vez de mostrar o ícone de imagem quebrada do navegador.
export function SignalImage({
  src,
  alt,
  className,
  style,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} style={style} loading="lazy" onError={() => setFailed(true)} />
  );
}
