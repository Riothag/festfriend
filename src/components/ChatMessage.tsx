import type { ChatMessage as TChatMessage } from "@/types";
import { stages } from "@/data/stages";

// Tailwind classes per stage. Same palette family across the app so a glance
// at a chip tells you which stage you're looking at.
const STAGE_STYLES: Record<string, string> = {
  "Festival Stage": "bg-amber-400/20 text-amber-200 border-amber-400/40",
  "Shell Gentilly Stage": "bg-orange-500/20 text-orange-200 border-orange-500/40",
  "Congo Square Stage": "bg-red-500/20 text-red-200 border-red-500/40",
  "Sheraton New Orleans Fais Do-Do Stage": "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  "Jazz & Heritage Stage": "bg-yellow-600/20 text-yellow-200 border-yellow-600/40",
  "Blues Tent": "bg-sky-500/20 text-sky-200 border-sky-500/40",
  "Gospel Tent": "bg-violet-500/20 text-violet-200 border-violet-500/40",
  "Economy Hall Tent": "bg-cyan-500/20 text-cyan-200 border-cyan-500/40",
  "WWOZ Jazz Tent": "bg-indigo-500/20 text-indigo-200 border-indigo-500/40",
  "Lagniappe Stage": "bg-pink-500/20 text-pink-200 border-pink-500/40",
  "Sandals Resorts Jamaica Cultural Exchange Pavilion": "bg-lime-500/20 text-lime-200 border-lime-500/40",
  "Allison Miner Music Heritage Stage": "bg-slate-400/20 text-slate-200 border-slate-400/40",
  "Rhythmpourium Tent": "bg-teal-500/20 text-teal-200 border-teal-500/40",
  "Ochsner Children's Tent": "bg-rose-500/20 text-rose-200 border-rose-500/40",
  "Food Heritage Stage": "bg-orange-700/20 text-orange-200 border-orange-700/40",
};
const DEFAULT_STAGE = "bg-gray-700/40 text-gray-200 border-gray-600/40";

// Weekend 1 days get a cool blue chip; weekend 2 gets a warm magenta.
const W1_DAYS = new Set(["Thu Apr 23", "Fri Apr 24", "Sat Apr 25", "Sun Apr 26"]);

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const STAGE_NAMES = stages
  .map((s) => s.stage_name)
  .sort((a, b) => b.length - a.length);
const STAGE_RE = new RegExp(`(${STAGE_NAMES.map(escapeRegex).join("|")})`, "g");
const DAY_RE = /\b(Thu|Fri|Sat|Sun) (Apr|May) \d{1,2}\b/g;
const TIME_RANGE_RE = /\b\d{1,2}:\d{2}\s?[AP]M\s?[–-]\s?\d{1,2}:\d{2}\s?[AP]M\b/g;

type Tok =
  | { type: "text"; value: string }
  | { type: "stage"; value: string }
  | { type: "day"; value: string }
  | { type: "time"; value: string };

function tokenize(text: string): Tok[] {
  type Match = { start: number; end: number; tok: Exclude<Tok, { type: "text" }> };
  const matches: Match[] = [];
  const collect = (re: RegExp, type: "stage" | "day" | "time") => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (!matches.some((x) => start < x.end && end > x.start)) {
        matches.push({ start, end, tok: { type, value: m[0] } });
      }
    }
  };
  collect(STAGE_RE, "stage");
  collect(DAY_RE, "day");
  collect(TIME_RANGE_RE, "time");
  matches.sort((a, b) => a.start - b.start);

  const out: Tok[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start > cursor) out.push({ type: "text", value: text.slice(cursor, m.start) });
    out.push(m.tok);
    cursor = m.end;
  }
  if (cursor < text.length) out.push({ type: "text", value: text.slice(cursor) });
  return out;
}

const chipBase =
  "inline-block rounded-md border px-1.5 py-0.5 text-[11px] font-semibold leading-none align-[2px] mx-[1px]";

function RichLine({ text }: { text: string }) {
  const toks = tokenize(text);
  return (
    <>
      {toks.map((tok, i) => {
        if (tok.type === "stage") {
          return (
            <span key={i} className={`${chipBase} ${STAGE_STYLES[tok.value] ?? DEFAULT_STAGE}`}>
              {tok.value}
            </span>
          );
        }
        if (tok.type === "day") {
          const cls = W1_DAYS.has(tok.value)
            ? "bg-blue-500/20 text-blue-200 border-blue-500/40"
            : "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/40";
          return (
            <span key={i} className={`${chipBase} ${cls}`}>
              {tok.value}
            </span>
          );
        }
        if (tok.type === "time") {
          return (
            <span
              key={i}
              className="inline-block rounded-md bg-gray-800 text-gray-100 border border-gray-700 px-1.5 py-0.5 text-[11px] font-mono leading-none align-[2px] mx-[1px]"
            >
              {tok.value}
            </span>
          );
        }
        return <span key={i}>{tok.value}</span>;
      })}
    </>
  );
}

export default function ChatMessage({ message }: { message: TChatMessage }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-yellow-400 text-black px-4 py-3 text-base leading-relaxed">
          {message.text}
        </div>
      </div>
    );
  }

  const lines = message.text.split("\n");
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-gray-900 text-white border border-gray-800 px-4 py-3 text-[15px] leading-relaxed space-y-1">
        {lines.map((line, i) => {
          if (line === "") return <div key={i} className="h-2" />;
          const isBullet = /^\s*•\s/.test(line);
          const isHeader = /:\s*$/.test(line) && !isBullet;
          if (isHeader) {
            return (
              <div key={i} className="text-xs uppercase tracking-wider font-bold text-gray-400 pt-1">
                <RichLine text={line.replace(/:\s*$/, "")} />
              </div>
            );
          }
          if (isBullet) {
            return (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-yellow-400 mt-[2px]">•</span>
                <span className="flex-1">
                  <RichLine text={line.replace(/^\s*•\s/, "")} />
                </span>
              </div>
            );
          }
          return (
            <div key={i}>
              <RichLine text={line} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
