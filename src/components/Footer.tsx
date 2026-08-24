export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white py-6">
      <div className="mx-auto max-w-5xl px-4 text-center text-sm text-gray-500">
        <p>
          Food hygiene rating data provided by the{" "}
          <a
            href="https://ratings.food.gov.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-700"
          >
            Food Standards Agency
          </a>
          , licensed under the{" "}
          <a
            href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-700"
          >
            Open Government Licence v3.0
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
