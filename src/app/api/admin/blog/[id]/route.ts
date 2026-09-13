import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// Auth via proxy.ts's /api/admin/* matcher. Updates a post wholesale (title, excerpt,
// content, cover image, status) — slug is immutable once created (see BlogPost's schema
// comment for why), so it's never accepted here.
const BlogPostSchema = z.object({
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().min(1).max(500),
  content: z.string().trim().min(1).max(50000),
  coverImageUrl: z.string().trim().url().optional().or(z.literal("")),
  status: z.enum(["draft", "published"]),
});

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

  const parsed = BlogPostSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid post data.");
  }

  try {
    const existing = await prisma.blogPost.findUnique({ where: { id: postId }, select: { publishedAt: true } });
    if (!existing) {
      return jsonError(404, `No post found with id ${postId}.`);
    }

    const { title, excerpt, content, coverImageUrl, status } = parsed.data;
    // Only stamps publishedAt the first time a post goes live — see the schema comment on
    // BlogPost.publishedAt for why a later unpublish/republish or plain edit shouldn't
    // bump it.
    const publishedAt = status === "published" && !existing.publishedAt ? new Date() : existing.publishedAt;

    const post = await prisma.blogPost.update({
      where: { id: postId },
      data: { title, excerpt, content, coverImageUrl: coverImageUrl || null, status, publishedAt },
    });

    return NextResponse.json({ data: post });
  } catch (err) {
    console.error(`POST /api/admin/blog/${id} failed:`, err);
    return jsonError(500, "Internal server error while saving the post.");
  }
}
