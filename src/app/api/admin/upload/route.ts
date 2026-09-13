import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

// Issues short-lived client tokens for direct browser-to-Blob uploads (see
// /admin/establishment/[id]/ProfileForm.tsx) rather than proxying the file bytes through
// this server — the same Fast-Origin-Transfer cost lesson as the category/establishment
// photos elsewhere in this app. Already gated by proxy.ts's /api/admin/* matcher, so no
// separate auth check needed here.
//
// Requires BLOB_READ_WRITE_TOKEN — auto-provided once a Blob store is connected in the
// Vercel dashboard; unset locally until you do that (see README "Deploying").
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
        maximumSizeInBytes: MAX_UPLOAD_BYTES,
        addRandomSuffix: true,
      }),
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed." }, { status: 400 });
  }
}
