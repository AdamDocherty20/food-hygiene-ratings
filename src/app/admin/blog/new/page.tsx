import type { Metadata } from "next";
import Link from "next/link";
import { BlogPostForm } from "../BlogPostForm";

export const metadata: Metadata = { title: "New post | Admin", robots: { index: false, follow: false } };

export default function NewBlogPostPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/admin/blog" className="text-sm font-medium text-indigo-600 hover:underline">
        ← All posts
      </Link>
      <h1 className="mt-4 text-xl font-bold text-gray-900">New post</h1>

      <div className="mt-6">
        <BlogPostForm initial={{ title: "", excerpt: "", content: "", coverImageUrl: "" }} initialStatus="draft" />
      </div>
    </div>
  );
}
