"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "fest-friend-install-dismissed";

export default function InstallBanner() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "true") return;

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    setIsIOS(/iPad|iPhone|iPod/.test(window.navigator.userAgent));
    setShow(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="bg-yellow-400 text-black px-4 py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="font-bold mb-0.5">📲 Save Fest Friend to your home screen</p>
          {isIOS ? (
            <p className="text-black/80">
              In Safari or Chrome, tap <span className="font-semibold">Share</span> then <span className="font-semibold">Add to Home Screen</span>.
            </p>
          ) : (
            <p className="text-black/80">
              In Chrome, tap the menu (⋮) then <span className="font-semibold">Add to Home screen</span>.
            </p>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss install banner"
          className="shrink-0 text-black/60 active:text-black text-2xl leading-none -mt-0.5"
        >
          ×
        </button>
      </div>
    </div>
  );
}
