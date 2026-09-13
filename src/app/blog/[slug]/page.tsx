import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { formatDate } from "@/lib/format";
import { buildBlogPostingJsonLd, buildBreadcrumbJsonLd } from "@/lib/jsonld";
import { prisma } from "@/lib/prisma";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const SITE_NAME = "Should I Eat Here";

// Posts only change through the admin editor — an hour of staleness is a non-issue, same
// reasoning as every other content page in this app (see /area, /guide).
export const revalidate = 3600;

async function getPublishedPost(slug: string) {
  return prisma.blogPost.findFirst({ where: { slug, status: "published" } });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return {};

  const title = `${post.title} | ${SITE_NAME}`;
  const url = `${SITE_URL}/blog/${post.slug}`;

  return {
    title,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: post.excerpt,
      url,
      type: "article",
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Blog", url: `${SITE_URL}/blog` },
    { name: post.title, url: `${SITE_URL}/blog/${post.slug}` },
  ]);
  const blogPostingJsonLd = buildBlogPostingJsonLd(post);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingJsonLd) }} />

      <nav className="text-sm text-gray-500">
        <Link href="/blog" className="hover:text-indigo-600 hover:underline">
          Blog
        </Link>
      </nav>

      <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{post.title}</h1>
      {post.publishedAt && <p className="mt-2 text-xs text-gray-400">{formatDate(post.publishedAt.toISOString())}</p>}

      {post.coverImageUrl && (
        <img
          src={post.coverImageUrl}
          alt=""
          className="mt-6 h-64 w-full rounded-xl object-cover sm:h-80"
          width={1200}
          height={630}
        />
      )}

      <div className="prose prose-sm sm:prose-base mt-6 max-w-none prose-headings:font-semibold prose-headings:text-gray-900 prose-a:text-indigo-600">
        <Markdown>{post.content}</Markdown>
      </div>

      <Link
        href="/blog"
        className="mt-10 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
      >
        ← Back to blog
      </Link>
    </div>
  );
}
