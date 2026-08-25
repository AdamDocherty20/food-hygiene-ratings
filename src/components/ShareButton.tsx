"use client";

import { useState } from "react";

interface ShareButtonProps {
  title: string;
  text: string;
}

// Uses the Web Share API where available (mobile browsers, most modern desktop browsers)
// to open the OS-native share sheet; falls back to copying the URL to the clipboard with
// a brief "Copied!" confirmation everywhere else.
export function ShareButton({ title, text }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // User cancelled the share sheet, or it failed silently — nothing to do.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied/unavailable — nothing more we can do here.
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.684 13.342a3 3 0 100 2.316l6.632 3.316a3 3 0 10.895-1.789l-6.632-3.316a3 3 0 000-.738l6.632-3.316a3 3 0 10-.895-1.789L8.684 11.026a3 3 0 000 2.316z"
        />
      </svg>
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
