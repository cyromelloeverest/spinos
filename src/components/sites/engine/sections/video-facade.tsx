"use client";

import { useState } from "react";

/**
 * The site's own photo with a play button in front of a YouTube/Vimeo player. The player is created on click, in
 * this page's own gesture, so it starts playing at once (with sound) instead of showing the platform's thumbnail.
 */
export function VideoFacade({ src, poster, posterAlt, title }: { src: string; poster: string; posterAlt: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  if (playing) {
    return (
      <iframe
        src={`${src}${src.includes("?") ? "&" : "?"}autoplay=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 h-full w-full border-0"
      />
    );
  }
  return (
    <button type="button" onClick={() => setPlaying(true)} aria-label={title} className="video-facade group absolute inset-0 h-full w-full cursor-pointer">
      <img src={poster} alt={posterAlt} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      <span aria-hidden className="absolute inset-0 m-auto flex size-20 items-center justify-center rounded-full bg-black/60 ring-2 ring-white/85 transition group-hover:scale-105 group-hover:bg-black/80">
        <svg viewBox="0 0 24 24" className="ml-1 size-9 fill-white">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </button>
  );
}
