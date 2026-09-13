import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostActions } from "./BlogPostActions";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Blog | Admin", robots: { index: false, follow: false } };

export const dynamic = "force-dynamic"; // always fresh — this is a small internal editor list, not a cached public page

export default async function AdminBlogPage() {
  const posts = await prisma.blogPost.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, slug: true, title: true, status: true, publishedAt: true, updatedAt: true },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Blog posts</h1>
        <form action="/api/admin/logout" method="post">
          <button type="submit" className="text-sm text-gray-500 hover:text-indigo-600">
            Log out
          </button>
        </form>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Link href="/admin/claims" className="text-sm font-medium text-indigo-600 hover:underline">
          ← Claims
        </Link>
        <Link
          href="/admin/blog/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          New post
        </Link>
      </div>

      <ul className="mt-6 flex flex-col gap-3">
        {posts.length === 0 && <p className="text-sm text-gray-500">No posts yet.</p>}
        {posts.map((post) => (
          <li key={post.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/admin/blog/${post.id}/edit`} className="font-medium text-gray-900 hover:text-indigo-600">
                    {post.title}
                  </Link>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      post.status === "published" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {post.status === "published" ? "Published" : "Draft"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {post.status === "published" && post.publishedAt
                    ? `Published ${formatDate(post.publishedAt.toISOString())}`
                    : `Last saved ${formatDate(post.updatedAt.toISOString())}`}
                </p>
                {post.status === "published" && (
                  <Link href={`/blog/${post.slug}`} target="_blank" className="mt-1 inline-block text-xs text-gray-500 hover:text-indigo-600">
                    View live ↗
                  </Link>
                )}
              </div>
              <BlogPostActions postId={post.id} status={post.status} title={post.title} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
