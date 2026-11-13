import { Sparkles } from "lucide-react";

type VerseCalloutTone = "purple" | "teal" | "blue" | "yellow" | "red";

type VerseCalloutProps = {
  title: string;
  message: string;
  verse: string;
  tone: VerseCalloutTone;
  className?: string;
};

const toneClasses: Record<
  VerseCalloutTone,
  { background: string; border: string; title: string; verse: string }
> = {
  purple: {
    background: "bg-purple-500/10",
    border: "border-purple-500/30",
    title: "text-purple-400",
    verse: "text-purple-300",
  },
  teal: {
    background: "bg-teal-500/10",
    border: "border-teal-500/30",
    title: "text-teal-400",
    verse: "text-teal-300",
  },
  blue: {
    background: "bg-ohel-blue/10",
    border: "border-ohel-blue/30",
    title: "text-ohel-blue",
    verse: "text-blue-300",
  },
  yellow: {
    background: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    title: "text-yellow-500",
    verse: "text-yellow-300",
  },
  red: {
    background: "bg-red-500/10",
    border: "border-red-500/30",
    title: "text-red-400",
    verse: "text-red-300",
  },
};

export function VerseCallout({
  title,
  message,
  verse,
  tone,
  className = "mt-4",
}: VerseCalloutProps) {
  const colors = toneClasses[tone];

  return (
    <div
      className={`${className} ${colors.background} border ${colors.border} p-4 rounded-xl text-center blessing-box`}
    >
      <p
        className={`${colors.title} font-bold text-sm mb-1 blessing-title flex items-center justify-center gap-2`}
      >
        <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{title}</span>
      </p>
      <p className="text-gray-200 text-xs mb-3 blessing-text">{message}</p>
      <p
        className={`${colors.verse} italic text-[11px] leading-relaxed break-words blessing-verse`}
      >
        {verse}
      </p>
    </div>
  );
}
