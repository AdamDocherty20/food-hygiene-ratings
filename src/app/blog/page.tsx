import type { Metadata } from "next";
import Link from "next/link";
import { buildBreadcrumbJsonLd } from "@/lib/jsonld";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const TITLE = "Blog";
const DESCRIPTION = "Guides, explainers and news on UK food hygiene ratings from Should I Eat Here.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/blog` },
};

// Posts only change when the operator publishes/edits one through /admin/blog — an hour
// of staleness is a non-issue, same reasoning as the /area and /guide pages.
export const revalidate = 3600;

export default async function BlogIndexPage() {
  const posts = await prisma.blogPost.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    select: { slug: true, title: true, excerpt: true, coverImageUrl: true, publishedAt: true },
  });

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Blog", url: `${SITE_URL}/blog` },
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <nav className="text-sm text-gray-500">
        <Link href="/" className="hover:text-indigo-600 hover:underline">
          Home
        </Link>
      </nav>

      <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">Blog</h1>
      <p className="mt-2 text-sm text-gray-600">{DESCRIPTION}</p>

      {posts.length === 0 ? (
        <p className="mt-8 text-sm text-gray-500">Nothing published yet — check back soon.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-6">
          {posts.map((post) => (
            <li key={post.slug} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm sm:flex">
              {post.coverImageUrl && (
                <Link href={`/blog/${post.slug}`} className="block shrink-0 sm:w-48">
                  <img
                    src={post.coverImageUrl}
                    alt=""
                    className="h-40 w-full object-cover sm:h-full"
                    loading="lazy"
                    width={400}
                    height={300}
                  />
                </Link>
              )}
              <div className="p-5">
                {post.publishedAt && <p className="text-xs text-gray-400">{formatDate(post.publishedAt.toISOString())}</p>}
                <Link href={`/blog/${post.slug}`} className="mt-1 block text-lg font-semibold text-gray-900 hover:text-indigo-600">
                  {post.title}
                </Link>
                <p className="mt-2 text-sm text-gray-600">{post.excerpt}</p>
                <Link href={`/blog/${post.slug}`} className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline">
                  Read more →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
