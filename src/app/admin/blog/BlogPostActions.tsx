"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/api-client";

export function BlogPostActions({ postId, status, title }: { postId: number; status: string; title: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggleStatus() {
    setPending(true);
    try {
      await postJson(`/api/admin/blog/${postId}/status`, { status: status === "published" ? "draft" : "published" });
      router.refresh();
    } catch {
      setPending(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    setPending(true);
    try {
      await postJson(`/api/admin/blog/${postId}/delete`, {});
      router.refresh();
    } catch {
      setPending(false);
    }
  }

  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={toggleStatus}
        className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
      >
        {status === "published" ? "Unpublish" : "Publish"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={remove}
        className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
