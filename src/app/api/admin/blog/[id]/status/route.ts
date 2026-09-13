import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// Auth via proxy.ts's /api/admin/* matcher. A narrow sibling to POST /api/admin/blog/[id]
// (the full wholesale update) just for the publish/unpublish toggle on the list page,
// so that page doesn't need to fetch every post's full (up to 50KB) content just to
// render a button.
const StatusSchema = z.object({ status: z.enum(["draft", "published"]) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) {
    return jsonError(400, `Invalid post id: "${id}".`);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Request body must be valid JSON.");
  }

  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid status.");
  }

  try {
    const existing = await prisma.blogPost.findUnique({ where: { id: postId }, select: { publishedAt: true } });
    if (!existing) {
      return jsonError(404, `No post found with id ${postId}.`);
    }

    const { status } = parsed.data;
    const publishedAt = status === "published" && !existing.publishedAt ? new Date() : existing.publishedAt;

    const post = await prisma.blogPost.update({ where: { id: postId }, data: { status, publishedAt } });
    return NextResponse.json({ data: post });
  } catch (err) {
    console.error(`POST /api/admin/blog/${id}/status failed:`, err);
    return jsonError(500, "Internal server error while updating the post status.");
  }
}
