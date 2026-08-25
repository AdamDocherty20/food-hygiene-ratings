import type { Metadata } from "next";
import Link from "next/link";
import { buildFaqJsonLd } from "@/lib/jsonld";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const TITLE = "About & FAQ";
const DESCRIPTION =
  "What FHRS and FHIS food hygiene ratings mean, how often the data updates, and where it comes from.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/about` },
};

// FHRS (England, Wales & Northern Ireland) rates on a 0-5 scale. Order matches the badge
// colouring used elsewhere in the app: 4-5 green, 2-3 amber, 0-1 red.
const FHRS_SCALE: { score: string; meaning: string }[] = [
  { score: "5", meaning: "Hygiene standards are very good" },
  { score: "4", meaning: "Hygiene standards are good" },
  { score: "3", meaning: "Hygiene standards are generally satisfactory" },
  { score: "2", meaning: "Some improvement is necessary" },
  { score: "1", meaning: "Major improvement is necessary" },
  { score: "0", meaning: "Urgent improvement is required" },
];

// FHIS (Scotland) is pass/fail rather than a numeric scale.
const FHIS_SCALE: { score: string; meaning: string }[] = [
  { score: "Pass", meaning: "The business meets the required food hygiene standards" },
  { score: "Improvement Required", meaning: "The business needs to make improvements to meet the required standards" },
  { score: "Exempt", meaning: "The business type is exempt from the scheme (e.g. very low risk)" },
  { score: "Awaiting Inspection", meaning: "The business hasn't been inspected yet, or a report hasn't been published" },
];

// Shared between the rendered FAQ section below and its FAQPage JSON-LD — keeping one
// source of truth means the structured data can never drift from what's actually on the
// page (a mismatch there is exactly what Google's structured-data guidelines warn against).
const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "How often is the data updated?",
    answer:
      "A sync job pulls the latest ratings from the Food Standards Agency once a day. The exact date the data was last refreshed is shown on the homepage.",
  },
  {
    question: "Who carries out the inspections?",
    answer:
      "Local authority environmental health officers carry out the inspections, not the FSA or this site. We only display the ratings they publish.",
  },
  {
    question: "Is this an official FSA site?",
    answer:
      "No. Should I Eat Here is an independent, unofficial tool and isn't affiliated with or endorsed by the Food Standards Agency. For the official source, visit ratings.food.gov.uk.",
  },
  {
    question: "A rating looks wrong or out of date — what do I do?",
    answer:
      "Ratings come directly from the FSA's published data, so any correction needs to happen at the source. Check the official listing on ratings.food.gov.uk — once it's corrected there, it will appear here at the next daily sync.",
  },
];

function ScaleTable({ rows }: { rows: { score: string; meaning: string }[] }) {
  return (
    <dl className="mt-4 divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
      {rows.map((row) => (
        <div key={row.score} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
          <dt className="shrink-0 text-sm font-semibold text-gray-900 sm:w-40">{row.score}</dt>
          <dd className="text-sm text-gray-600">{row.meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AboutPage() {
  const faqJsonLd = buildFaqJsonLd(FAQ_ITEMS);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">About &amp; FAQ</h1>
      <p className="mt-2 text-sm text-gray-600">
        Should I Eat Here makes it quick to check the official food hygiene rating for restaurants, takeaways,
        cafes, shops and other food businesses across the UK. Here&apos;s what the ratings mean and where the data
        comes from.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">What is the Food Hygiene Rating Scheme (FHRS)?</h2>
        <p className="mt-2 text-sm text-gray-600">
          FHRS is used in England, Wales and Northern Ireland. Local authority inspectors visit food businesses and
          score them from 0 to 5 based on food handling, hygiene facilities and management of food safety.
        </p>
        <ScaleTable rows={FHRS_SCALE} />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">What is the Food Hygiene Information Scheme (FHIS)?</h2>
        <p className="mt-2 text-sm text-gray-600">
          FHIS is the equivalent scheme used in Scotland. Rather than a 0-5 score, businesses are simply marked as
          passing the required standards or needing improvement.
        </p>
        <ScaleTable rows={FHIS_SCALE} />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Frequently asked questions</h2>
        <div className="mt-4 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">How often is the data updated?</h3>
            <p className="mt-1 text-sm text-gray-600">
              A sync job pulls the latest ratings from the Food Standards Agency once a day. The exact date the
              data was last refreshed is shown on the homepage.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Who carries out the inspections?</h3>
            <p className="mt-1 text-sm text-gray-600">
              Local authority environmental health officers carry out the inspections, not the FSA or this site. We
              only display the ratings they publish.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Is this an official FSA site?</h3>
            <p className="mt-1 text-sm text-gray-600">
              No. Should I Eat Here is an independent, unofficial tool and isn&apos;t affiliated with or endorsed by
              the Food Standards Agency. For the official source, visit{" "}
              <a
                href="https://ratings.food.gov.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-600 underline-offset-2 hover:underline"
              >
                ratings.food.gov.uk
              </a>
              .
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">A rating looks wrong or out of date — what do I do?</h3>
            <p className="mt-1 text-sm text-gray-600">
              Ratings come directly from the FSA&apos;s published data, so any correction needs to happen at the
              source. Check the official listing on{" "}
              <a
                href="https://ratings.food.gov.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-600 underline-offset-2 hover:underline"
              >
                ratings.food.gov.uk
              </a>{" "}
              — once it&apos;s corrected there, it will appear here at the next daily sync.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Data licensing</h2>
        <p className="mt-2 text-sm text-gray-600">
          Food hygiene rating data is provided by the Food Standards Agency, licensed under the{" "}
          <a
            href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-indigo-600 underline-offset-2 hover:underline"
          >
            Open Government Licence v3.0
          </a>
          .
        </p>
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
