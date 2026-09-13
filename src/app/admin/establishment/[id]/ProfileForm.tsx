"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";
import { ApiError, postJson } from "@/lib/api-client";

interface ProfileData {
  description: string;
  website: string;
  phone: string;
  photoUrls: string[];
}

// Photos upload directly from this browser to Vercel Blob (see /api/admin/upload) rather
// than through this app's server — same reasoning as everywhere else in this app that a
// per-visitor payload could otherwise rack up Vercel Function bandwidth. This form is the
// one place in the whole app that writes photoUrls at all; the public establishment page
// only ever reads BusinessProfile, never writes it (see BusinessProfile's schema comment
// for why content flows through the operator, not a self-serve owner editor, for now).
export function ProfileForm({ fhrsId, initial }: { fhrsId: number; initial: ProfileData }) {
  const [data, setData] = useState(initial);
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
      const blob = await upload(`business-profiles/${fhrsId}/${Date.now()}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
      });
      setData((prev) => ({ ...prev, photoUrls: [...prev.photoUrls, blob.url] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePhoto(url: string) {
    setData((prev) => ({ ...prev, photoUrls: prev.photoUrls.filter((u) => u !== url) }));
  }

  async function handleSave() {
    setSaveState("saving");
    setError(null);
    try {
      await postJson(`/api/admin/establishment/${fhrsId}/profile`, data);
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setError(err instanceof ApiError ? err.message : "Save failed.");
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {error && <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          rows={4}
          value={data.description}
          onChange={(e) => setData((prev) => ({ ...prev, description: e.target.value }))}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="website" className="text-sm font-medium text-gray-700">
          Website
        </label>
        <input
          id="website"
          type="text"
          placeholder="https://..."
          value={data.website}
          onChange={(e) => setData((prev) => ({ ...prev, website: e.target.value }))}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-sm font-medium text-gray-700">
          Phone
        </label>
        <input
          id="phone"
          type="text"
          value={data.phone}
          onChange={(e) => setData((prev) => ({ ...prev, phone: e.target.value }))}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700">Photos</span>
        <p className="text-xs text-gray-500">The first photo becomes the listing&rsquo;s main image.</p>
        {data.photoUrls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.photoUrls.map((url) => (
              <div key={url} className="relative">
                <img src={url} alt="" className="h-24 w-24 rounded-md object-cover" width={200} height={200} />
                <button
                  type="button"
                  onClick={() => removePhoto(url)}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white"
                  aria-label="Remove photo"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} disabled={uploading} className="text-sm" />
        {uploading && <p className="text-xs text-gray-500">Uploading…</p>}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saveState === "saving"}
        className="mt-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}
      </button>
    </div>
  );
}
