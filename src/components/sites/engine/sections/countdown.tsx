"use client";

import { useEffect, useState } from "react";

const UNITS = [86400, 3600, 60, 1];

/** Time left until the end of `date` in Brasília. The server renders dashes: the clock only exists in the browser. */
export function Countdown({ date, labels, endedText }: { date: string; labels: [string, string, string, string]; endedText?: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const end = new Date(`${date}T23:59:59-03:00`).getTime();
    const tick = () => setLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [date]);

  if (left === 0) return endedText ? <p className="promo-ended">{endedText}</p> : null;
  return (
    <div role="timer" className="promo-clock">
      {UNITS.map((unit, i) => {
        const value = left === null ? "--" : String(Math.floor((i === 0 ? left : left % UNITS[i - 1]!) / unit)).padStart(2, "0");
        return (
          <div key={unit} className="promo-clock-cell">
            <span className="promo-clock-value">{value}</span>
            <span className="promo-clock-label">{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}
