import type { Metadata } from "next";
import Link from "next/link";
import { buildBreadcrumbJsonLd } from "@/lib/jsonld";
import { LOCAL_AUTHORITIES } from "@/lib/local-authorities";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const TITLE = "How to Check a Food Hygiene Rating Before You Eat Out";
const DESCRIPTION =
  "A practical guide to UK food hygiene ratings — how to check a restaurant's score before you book, what the numbers actually mean, and how often they're updated.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/guide` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/guide` },
};

// A handful of the highest-traffic areas, for the "browse by area" links at the bottom —
// picked dynamically from the real data rather than a hand-picked list, so it stays
// accurate as establishment counts shift over time.
const FEATURED_AREA_COUNT = 8;

export default function GuidePage() {
  const featuredAreas = [...LOCAL_AUTHORITIES].sort((a, b) => b.count - a.count).slice(0, FEATURED_AREA_COUNT);

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Guide", url: `${SITE_URL}/guide` },
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <nav className="text-sm text-gray-500">
        <Link href="/" className="hover:text-indigo-600 hover:underline">
          Home
        </Link>
      </nav>

      <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
        How to Check a Food Hygiene Rating Before You Eat Out
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Every restaurant, takeaway, cafe and food shop in the UK is inspected and given an official hygiene rating —
        here&apos;s how to actually use that information before you book a table or order in.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">What a hygiene rating actually tells you</h2>
        <p className="mt-2 text-sm text-gray-600">
          A food hygiene rating is a snapshot from a local authority inspector&apos;s most recent visit, not a
          permanent grade. It covers three things: how safely food is handled and prepared, how clean and
          well-maintained the premises are, and how well management understands and controls food safety risks. It
          says nothing directly about taste, service or value — only about the risk of getting food poisoning there.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          England, Wales and Northern Ireland use the Food Hygiene Rating Scheme (FHRS), a 0-5 scale. Scotland uses
          the separate Food Hygiene Information Scheme (FHIS), which is pass/fail rather than numeric. See the{" "}
          <Link href="/about" className="text-indigo-600 hover:underline">
            full ratings breakdown
          </Link>{" "}
          for what each score and status means.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Checking a rating before you go</h2>
        <p className="mt-2 text-sm text-gray-600">
          The quickest way is to search by the business&apos;s name or postcode on the{" "}
          <Link href="/" className="text-indigo-600 hover:underline">
            homepage
          </Link>
          . If you don&apos;t have a specific place in mind yet, browsing by area is usually more useful — every UK
          local authority has its own page listing the top-rated restaurants, takeaways, pubs and other food
          businesses there, sorted by their most recent inspection.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          It&apos;s worth checking the inspection date alongside the score. A 5-star rating from three years ago is
          weaker evidence than a 5 from last month — busy kitchens change staff, suppliers and standards over time,
          and inspections don&apos;t happen on a fixed schedule for every business.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">What a low rating doesn&apos;t necessarily mean</h2>
        <p className="mt-2 text-sm text-gray-600">
          A 0-2 rating means the inspector found problems serious enough to require improvement, but it&apos;s a
          rating of a specific visit, not the business forever. Many places address the issues and get re-inspected
          — check the rating date and, on this site, the establishment&apos;s rating history to see whether a low
          score is old news or current. Newly opened businesses also sometimes show as &quot;Awaiting
          Inspection&quot; simply because an inspector hasn&apos;t visited yet, which isn&apos;t the same as a poor
          rating.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">How fresh is the data?</h2>
        <p className="mt-2 text-sm text-gray-600">
          This site syncs directly from the Food Standards Agency&apos;s published data once a day, so a newly
          published inspection result typically shows up here within 24 hours of the FSA releasing it. See the{" "}
          <Link href="/about" className="text-indigo-600 hover:underline">
            About &amp; FAQ page
          </Link>{" "}
          for more on where the data comes from and how to report something that looks wrong.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Browse ratings near you</h2>
        <p className="mt-2 text-sm text-gray-600">Jump straight to the top-rated places in some of the busiest areas, or see the full list.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {featuredAreas.map((authority) => (
            <Link
              key={authority.slug}
              href={`/area/${authority.slug}`}
              className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-indigo-300 hover:text-indigo-600"
            >
              {authority.name}
            </Link>
          ))}
        </div>
        <Link href="/area" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
          See all UK areas →
        </Link>
      </section>

      <Link
        href="/"
        className="mt-10 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        Back to search
      </Link>
    </div>
  );
}
