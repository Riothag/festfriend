"use client";

import { useEffect, useState } from "react";
import EmailGate from "@/components/EmailGate";
import ChatApp from "@/components/ChatApp";

const UNLOCK_KEY = "fest-friend-unlocked";
const EMAIL_KEY = "fest-friend-email";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    setUnlocked(localStorage.getItem(UNLOCK_KEY) === "true");
    setMounted(true);
  }, []);

  // Avoid hydration flash — render nothing on first paint.
  if (!mounted) {
    return <div className="min-h-[100svh] bg-black" />;
  }

  const handleUnlock = (email: string) => {
    localStorage.setItem(UNLOCK_KEY, "true");
    localStorage.setItem(EMAIL_KEY, email);
    setUnlocked(true);
  };

  return unlocked ? <ChatApp /> : <EmailGate onUnlock={handleUnlock} />;
}
