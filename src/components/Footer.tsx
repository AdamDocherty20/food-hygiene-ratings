export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white py-8">
      <div className="mx-auto max-w-5xl px-4 text-center text-sm text-gray-500">
        <p>
          Food hygiene rating data provided by the{" "}
          <a
            href="https://ratings.food.gov.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-indigo-600 underline-offset-2 hover:underline"
          >
            Food Standards Agency
          </a>
          , licensed under the{" "}
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
        <p className="mx-auto mt-2 max-w-2xl text-xs text-gray-400">
          This is an independent, unofficial tool and is not affiliated with or endorsed by the Food Standards
          Agency. For the official ratings, visit{" "}
          <a
            href="https://ratings.food.gov.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600"
          >
            ratings.food.gov.uk
          </a>
          .
        </p>
        <p className="mt-4 text-xs text-gray-400">
          Created by{" "}
          <a
            href="https://adamdocherty.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-indigo-600 underline-offset-2 hover:underline"
          >
            adamdocherty.com
          </a>
        </p>
      </div>
    </footer>
  );
}
