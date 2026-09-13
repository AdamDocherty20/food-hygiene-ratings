import Link from "next/link";
import { FooterIllustration } from "@/components/FooterIllustration";

// Reused from Header.tsx's BrandMark, but inverted (white on transparent) for readability
// against the footer's own indigo/blue background — the header's gradient mark would have
// almost no contrast sitting on the same gradient here.
const STAR_PATH = "M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z";

function LinkColumn({ title, links }: { title: string; links: { href: string; label: string; external?: boolean }[] }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-indigo-200 uppercase">{title}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-100 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className="text-sm text-indigo-100 transition-colors hover:text-white">
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer>
      <div className="bg-gray-50 pt-10 pb-6 text-center">
        <FooterIllustration />
        <h2 className="mt-2 text-lg font-bold tracking-tight text-gray-900">Know before you go.</h2>
        <p className="mx-auto mt-1 max-w-sm px-4 text-sm text-gray-500">
          Official UK food hygiene ratings for every restaurant, takeaway and shop we could find.
        </p>
      </div>

      {/* The wave's own fill is a flat indigo-600 — matching the gradient band below at the
          seam (its top-left, where the gradient is still closest to pure indigo-600) is what
          makes the two pieces read as one continuous shape rather than two stacked blocks. */}
      <svg viewBox="0 0 1440 60" className="block w-full text-indigo-600" preserveAspectRatio="none" aria-hidden>
        <path fill="currentColor" d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z" />
      </svg>

      <div className="bg-gradient-to-br from-indigo-600 to-blue-600">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-white">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607Z"
                  />
                  <path d={STAR_PATH} fill="#fbbf24" transform="translate(5.5,5.675) scale(0.35)" />
                </svg>
                Should I Eat Here
              </Link>
              <p className="mt-3 max-w-[20ch] text-sm text-indigo-100">
                Independent, unofficial, and not affiliated with the Food Standards Agency.
              </p>
            </div>

            <LinkColumn
              title="Explore"
              links={[
                { href: "/area", label: "Browse by Area" },
                { href: "/guide", label: "Guide" },
                { href: "/about", label: "About & FAQ" },
              ]}
            />
            <LinkColumn
              title="Legal"
              links={[
                { href: "/privacy", label: "Privacy Policy" },
                { href: "/terms", label: "Terms" },
              ]}
            />
            <LinkColumn
              title="Official data"
              links={[
                { href: "https://ratings.food.gov.uk", label: "ratings.food.gov.uk", external: true },
                { href: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", label: "Open Government Licence v3.0", external: true },
              ]}
            />
          </div>

          <div className="mt-10 flex flex-col items-center gap-2 border-t border-white/20 pt-6 text-xs text-indigo-200 sm:flex-row sm:justify-between">
            <p>&copy; {new Date().getFullYear()} Should I Eat Here. Food hygiene data from the Food Standards Agency.</p>
            <p>
              Created by{" "}
              <a href="https://adamdocherty.com/" target="_blank" rel="noopener noreferrer" className="font-medium text-white hover:underline">
                adamdocherty.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
