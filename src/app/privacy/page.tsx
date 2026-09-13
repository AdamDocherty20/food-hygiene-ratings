import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const TITLE = "Privacy Policy";
const DESCRIPTION = "What data Should I Eat Here collects, why, and how to contact us about it.";
const CONTACT_EMAIL = "adamdocherty100@gmail.com";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/privacy` },
  robots: { index: true, follow: true },
};

// Written to describe what this specific site actually does, not a generic template —
// e.g. it doesn't claim we use tracking cookies or sell data, because we don't. Update
// this if the site's actual data practices change (new tracking, a login system, etc.)
// rather than leaving it to drift out of sync with reality.
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated 13 September 2026.</p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Who runs this site</h2>
        <p className="mt-2 text-sm text-gray-600">
          Should I Eat Here is an independent site run by Adam Docherty. If you have any question about this
          policy or your data, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-indigo-600 underline-offset-2 hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">What we collect</h2>
        <p className="mt-2 text-sm text-gray-600">
          Browsing and searching the site doesn&apos;t require an account and doesn&apos;t collect anything
          identifying you. The only personal information we collect is what you choose to submit through the{" "}
          <strong>&ldquo;Claim this business&rdquo;</strong> form on an establishment&apos;s page: your name, email
          address, phone number (optional), your relationship to the business, and any message you add. That&apos;s
          used solely to review the claim and get back to you about it — it&apos;s never sold, shared with third
          parties for marketing, or used for anything else.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">What we don&apos;t do</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>No visitor accounts, passwords, or logins (the only login on this site is a staff-only admin area).</li>
          <li>No advertising or cross-site tracking cookies.</li>
          <li>No selling or sharing of personal data with third parties for marketing.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Saved and recently viewed establishments</h2>
        <p className="mt-2 text-sm text-gray-600">
          The &ldquo;Save&rdquo; feature and the &ldquo;Recently viewed&rdquo; list both use your browser&apos;s
          local storage only — that data stays on your device, is never sent to our server, and isn&apos;t tied to
          any account (there isn&apos;t one). Clearing your browser&apos;s site data removes it.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Cookies</h2>
        <p className="mt-2 text-sm text-gray-600">
          The only cookie this site sets is a session cookie for the password-protected staff admin area, used
          purely to keep that login working — it&apos;s never set for ordinary visitors browsing or searching the
          site. We don&apos;t use advertising, tracking, or analytics cookies.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Analytics</h2>
        <p className="mt-2 text-sm text-gray-600">
          We use Vercel Web Analytics to see how many people visit the site and which pages are popular. It&apos;s
          cookieless and doesn&apos;t track you individually or across other sites — it reports aggregated numbers
          only.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Third-party services</h2>
        <p className="mt-2 text-sm text-gray-600">This site pulls in a few external services to work properly:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>
            <strong>Food Standards Agency, OpenStreetMap, Wikidata, Companies House</strong> — public open data
            about establishments (ratings, cuisine, company info), fetched by our own server. None of this
            involves your personal data.
          </li>
          <li>
            <strong>Google Places</strong> — where available, an establishment&apos;s photo is loaded directly from
            Google&apos;s servers by your browser, which means Google may log standard request data (like your IP
            address) for that request, under{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-indigo-600 underline-offset-2 hover:underline"
            >
              Google&apos;s own privacy policy
            </a>
            .
          </li>
          <li>
            <strong>Map tiles</strong> (OpenStreetMap or a configured alternative) — loaded directly by your
            browser when a map is shown, the same way any embedded map works.
          </li>
          <li>
            <strong>Vercel</strong> — our hosting provider, which processes requests to serve the site.
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Data retention</h2>
        <p className="mt-2 text-sm text-gray-600">
          Business claim submissions are kept for as long as needed to review them and, if approved, to maintain
          the resulting listing. You can ask us to delete a claim you submitted at any time.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Your rights</h2>
        <p className="mt-2 text-sm text-gray-600">
          If you&apos;ve submitted a claim, you can ask us to show you what we hold, correct it, or delete it, by
          emailing{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-indigo-600 underline-offset-2 hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Children</h2>
        <p className="mt-2 text-sm text-gray-600">
          This site isn&apos;t directed at children and we don&apos;t knowingly collect information from anyone
          under 13.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Changes to this policy</h2>
        <p className="mt-2 text-sm text-gray-600">
          If this policy changes, we&apos;ll update the date at the top of this page.
        </p>
      </section>
    </div>
  );
}
