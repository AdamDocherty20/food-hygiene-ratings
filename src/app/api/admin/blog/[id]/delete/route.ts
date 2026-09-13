import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// Auth via proxy.ts's /api/admin/* matcher.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) {
    return jsonError(400, `Invalid post id: "${id}".`);
  }

  try {
    await prisma.blogPost.delete({ where: { id: postId } });
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    console.error(`POST /api/admin/blog/${id}/delete failed:`, err);
    return jsonError(500, "Internal server error while deleting the post.");
  }
}
