import type { ChatMessage as TChatMessage } from "@/types";

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
      <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-gray-100 text-black border border-gray-200 px-4 py-3 text-[15px] leading-relaxed space-y-1">
        {lines.map((line, i) => {
          if (line === "") return <div key={i} className="h-2" />;
          const isBullet = /^\s*•\s/.test(line);
          const isHeader = /:\s*$/.test(line) && !isBullet;
          if (isHeader) {
            return (
              <div key={i} className="text-xs uppercase tracking-wider font-bold text-gray-500 pt-1">
                {line.replace(/:\s*$/, "")}
              </div>
            );
          }
          if (isBullet) {
            return (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-amber-500 mt-[2px]">•</span>
                <span className="flex-1">{line.replace(/^\s*•\s/, "")}</span>
              </div>
            );
          }
          return <div key={i}>{line}</div>;
        })}
      </div>
    </div>
  );
}
