import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-gray-900">
          UK Food Hygiene Ratings
        </Link>
      </div>
    </header>
  );
}
