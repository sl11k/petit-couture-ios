import { useEffect, useState } from "react";

/**
 * Auto-rotating announcement bar (carousel).
 * Cycles through messages every 4s with a fade transition.
 * Pauses on hover and respects prefers-reduced-motion.
 */
export function AnnouncementBar({
  messages,
  intervalMs = 4000,
  className = "",
}: {
  messages: string[];
  intervalMs?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!messages || messages.length <= 1 || paused) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, intervalMs);
    return () => clearInterval(t);
  }, [messages, intervalMs, paused]);

  if (!messages || messages.length === 0) return null;

  return (
    <div
      className={["relative overflow-hidden h-5 leading-5", className].join(" ")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-live="polite"
      aria-atomic="true"
    >
      {messages.map((msg, i) => (
        <span
          key={i}
          className={[
            "absolute inset-0 flex items-center justify-center text-center transition-opacity duration-700 ease-out",
            i === index ? "opacity-100" : "opacity-0 pointer-events-none",
          ].join(" ")}
        >
          {msg}
        </span>
      ))}
    </div>
  );
}
