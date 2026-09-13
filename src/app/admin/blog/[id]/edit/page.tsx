import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogPostForm } from "../../BlogPostForm";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Edit post | Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();

  const post = await prisma.blogPost.findUnique({ where: { id: postId } });
  if (!post) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/admin/blog" className="text-sm font-medium text-indigo-600 hover:underline">
        ← All posts
      </Link>
      <h1 className="mt-4 text-xl font-bold text-gray-900">{post.title}</h1>
      {post.status === "published" && (
        <Link href={`/blog/${post.slug}`} target="_blank" className="text-sm text-gray-500 hover:text-indigo-600">
          View live listing ↗
        </Link>
      )}

      <div className="mt-6">
        <BlogPostForm
          postId={post.id}
          initial={{
            title: post.title,
            excerpt: post.excerpt,
            content: post.content,
            coverImageUrl: post.coverImageUrl ?? "",
          }}
          initialStatus={post.status === "published" ? "published" : "draft"}
        />
      </div>
    </div>
  );
}
