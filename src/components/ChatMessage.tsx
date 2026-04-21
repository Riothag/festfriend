import type { ChatMessage as TChatMessage } from "@/types";

export default function ChatMessage({ message }: { message: TChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-base leading-relaxed",
          isUser
            ? "bg-yellow-400 text-black rounded-br-md"
            : "bg-gray-900 text-white rounded-bl-md border border-gray-800",
        ].join(" ")}
      >
        {message.text}
      </div>
    </div>
  );
}
