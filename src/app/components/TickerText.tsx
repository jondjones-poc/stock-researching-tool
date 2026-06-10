'use client';

interface TickerTextProps {
  text: string;
  className?: string;
}

export default function TickerText({ text, className = '' }: TickerTextProps) {
  if (!text) return null;

  return (
    <div
      className={`relative min-w-0 overflow-hidden whitespace-nowrap ${className}`}
      title={text}
    >
      <div className="inline-flex w-max animate-ticker">
        <span className="shrink-0 whitespace-nowrap pr-12">{text}</span>
        <span className="shrink-0 whitespace-nowrap pr-12" aria-hidden>
          {text}
        </span>
      </div>
    </div>
  );
}
