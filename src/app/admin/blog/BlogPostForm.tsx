"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ApiError, postJson } from "@/lib/api-client";

interface PostData {
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
}

interface BlogPostFormProps {
  // "new" posts to POST /api/admin/blog; existing posts POST to
  // /api/admin/blog/[postId] — same form either way, just a different target and
  // initial status (a brand new post has no status yet, so "create" always starts from
  // whichever button the author clicks).
  postId?: number;
  initial: PostData;
  initialStatus: "draft" | "published";
}

export function BlogPostForm({ postId, initial, initialStatus }: BlogPostFormProps) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [status, setStatus] = useState(initialStatus);
  const [uploading, setUploading] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await upload(`blog-posts/${Date.now()}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
      });
      setData((prev) => ({ ...prev, coverImageUrl: blob.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function save(nextStatus: "draft" | "published") {
    setSaveState("saving");
    setError(null);
    try {
      const body = { ...data, status: nextStatus };
      if (postId) {
        await postJson(`/api/admin/blog/${postId}`, body);
        setStatus(nextStatus);
        setSaveState("saved");
      } else {
        const result = await postJson<{ data: { id: number } }>("/api/admin/blog", body);
        router.push(`/admin/blog/${result.data.id}/edit`);
      }
    } catch (err) {
      setSaveState("error");
      setError(err instanceof ApiError ? err.message : "Save failed.");
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {error && <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={data.title}
          onChange={(e) => setData((prev) => ({ ...prev, title: e.target.value }))}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="excerpt" className="text-sm font-medium text-gray-700">
          Excerpt
        </label>
        <p className="text-xs text-gray-500">Shown on the blog listing and used as the meta description.</p>
        <textarea
          id="excerpt"
          rows={2}
          value={data.excerpt}
          onChange={(e) => setData((prev) => ({ ...prev, excerpt: e.target.value }))}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="content" className="text-sm font-medium text-gray-700">
          Content
        </label>
        <p className="text-xs text-gray-500">
          Markdown supported — <code>## Heading</code>, <code>**bold**</code>, <code>[link](https://...)</code>, <code>- list item</code>.
        </p>
        <textarea
          id="content"
          rows={16}
          value={data.content}
          onChange={(e) => setData((prev) => ({ ...prev, content: e.target.value }))}
          className="rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700">Cover image</span>
        {data.coverImageUrl && (
          <div className="relative w-fit">
            <img src={data.coverImageUrl} alt="" className="h-32 w-56 rounded-md object-cover" width={400} height={225} />
            <button
              type="button"
              onClick={() => setData((prev) => ({ ...prev, coverImageUrl: "" }))}
              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white"
              aria-label="Remove cover image"
            >
              ✕
            </button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} disabled={uploading} className="text-sm" />
        {uploading && <p className="text-xs text-gray-500">Uploading…</p>}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => save("draft")}
          disabled={saveState === "saving"}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save as draft
        </button>
        <button
          type="button"
          onClick={() => save("published")}
          disabled={saveState === "saving"}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "published" ? "Save & keep published" : "Publish"}
        </button>
        {saveState === "saved" && <span className="text-sm text-green-700">Saved ✓</span>}
      </div>
    </div>
  );
}
