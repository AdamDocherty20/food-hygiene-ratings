import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-response";
import { generateUniquePostSlug } from "@/lib/blog";
import { prisma } from "@/lib/prisma";

// Auth via proxy.ts's /api/admin/* matcher. Creates a new post — slug is derived
// server-side from the title (see generateUniquePostSlug) rather than accepted from the
// client, so it can never collide or be left empty.
const BlogPostSchema = z.object({
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().min(1).max(500),
  content: z.string().trim().min(1).max(50000),
  coverImageUrl: z.string().trim().url().optional().or(z.literal("")),
  status: z.enum(["draft", "published"]),
});

export async function POST(request: NextRequest) {
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
    const { title, excerpt, content, coverImageUrl, status } = parsed.data;
    const slug = await generateUniquePostSlug(title);

    const post = await prisma.blogPost.create({
      data: {
        slug,
        title,
        excerpt,
        content,
        coverImageUrl: coverImageUrl || null,
        status,
        publishedAt: status === "published" ? new Date() : null,
      },
    });

    return NextResponse.json({ data: post });
  } catch (err) {
    console.error("POST /api/admin/blog failed:", err);
    return jsonError(500, "Internal server error while creating the post.");
  }
}
