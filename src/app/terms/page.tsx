import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const TITLE = "Terms and Conditions";
const DESCRIPTION = "The terms for using Should I Eat Here, including where the ratings data comes from and its limitations.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/terms` },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Terms and Conditions</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated 13 September 2026.</p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">About this site</h2>
        <p className="mt-2 text-sm text-gray-600">
          Should I Eat Here is an independent, unofficial tool for looking up UK food hygiene ratings. It isn&apos;t
          affiliated with or endorsed by the Food Standards Agency. By using this site, you agree to the terms
          below.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Accuracy of information</h2>
        <p className="mt-2 text-sm text-gray-600">
          Ratings and establishment details are sourced from the Food Standards Agency, OpenStreetMap, Wikidata,
          Companies House and Google Places, and are shown as published by those sources at the time we last
          synced. We don&apos;t guarantee this information is complete, accurate, or up to date, and matches to
          other data sources (company records, cuisine tags, photos) are made automatically and can occasionally
          be wrong. For anything you&apos;re relying on — especially a business&apos;s current hygiene rating —
          always check the{" "}
          <a
            href="https://ratings.food.gov.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-indigo-600 underline-offset-2 hover:underline"
          >
            official FSA source
          </a>
          .
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Acceptable use</h2>
        <p className="mt-2 text-sm text-gray-600">
          Use the site for personal, non-commercial lookups. Don&apos;t attempt to scrape, bulk-download, or
          circumvent rate limits on the site or its API beyond ordinary browsing — the underlying FSA data is
          freely available directly from the FSA under the Open Government Licence if you need it in bulk.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Claiming a business</h2>
        <p className="mt-2 text-sm text-gray-600">
          If you submit a claim for a business, you&apos;re confirming you&apos;re authorised to represent it. We
          review every claim manually before anything changes on a listing, and we can reject a claim or remove
          added content at our discretion — for example if it turns out to be inaccurate, inappropriate, or
          submitted in bad faith.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Data licensing and attribution</h2>
        <p className="mt-2 text-sm text-gray-600">Content on this site is used under, and where required attributed to, its original licence:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>Food Standards Agency ratings — Open Government Licence v3.0</li>
          <li>OpenStreetMap contributions — Open Database Licence (ODbL)</li>
          <li>Wikidata facts — CC0</li>
          <li>Companies House records — available under the Companies House data licence</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Third-party links</h2>
        <p className="mt-2 text-sm text-gray-600">
          This site links out to official sources, business websites, and services like Google Maps for
          directions. We&apos;re not responsible for the content or availability of any external site you reach
          from here.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Limitation of liability</h2>
        <p className="mt-2 text-sm text-gray-600">
          The site is provided &ldquo;as is&rdquo;, without warranty of any kind. To the fullest extent permitted
          by law, we&apos;re not liable for any loss or damage arising from your use of the site or reliance on
          information shown on it, including decisions about where to eat.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Changes to these terms</h2>
        <p className="mt-2 text-sm text-gray-600">
          We may update these terms from time to time — the date at the top of this page reflects the latest
          version. Continuing to use the site after a change means you accept the updated terms.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Governing law</h2>
        <p className="mt-2 text-sm text-gray-600">These terms are governed by the law of England and Wales.</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
        <p className="mt-2 text-sm text-gray-600">
          A contact address for questions about these terms will be published here shortly. See also our{" "}
          <Link href="/privacy" className="font-medium text-indigo-600 underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
