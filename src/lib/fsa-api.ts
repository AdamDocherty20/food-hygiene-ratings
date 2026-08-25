// Thin client for the FSA's *live* per-establishment API (api.ratings.food.gov.uk) — a
// separate service from the bulk CSV that scripts/sync.ts imports daily. The bulk feed
// doesn't include everything the FSA publishes per establishment (phone number, the
// business's right-to-reply comment, the FHRS component score breakdown, or whether a
// re-inspection has happened but not yet been published) — so those fields are fetched
// live, on demand, rather than stored. Failures here are non-fatal: the establishment
// page works fine without this extra colour, so callers should treat a null return as
// "nothing extra to show" rather than an error.

const FSA_API_BASE = "https://api.ratings.food.gov.uk";
const FETCH_TIMEOUT_MS = 4000;

export interface FsaScores {
  hygiene: number;
  structural: number;
  confidenceInManagement: number;
}

export interface FsaEstablishmentDetail {
  phone: string | null;
  rightToReply: string | null;
  newRatingPending: boolean;
  scores: FsaScores | null;
}

interface FsaApiResponse {
  Phone?: string;
  RightToReply?: string;
  NewRatingPending?: boolean;
  scores?: { Hygiene?: number | null; Structural?: number | null; ConfidenceInManagement?: number | null };
}

function nullableString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function fetchFsaEstablishmentDetail(fhrsId: number): Promise<FsaEstablishmentDetail | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${FSA_API_BASE}/Establishments/${fhrsId}`, {
      headers: { "x-api-version": "2", accept: "application/json" },
      signal: controller.signal,
      // Shared across visitors and refreshed hourly — this data changes about as often
      // as our own sync data does, so there's no benefit to hitting the FSA API on every
      // page view.
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;

    const body = (await response.json()) as FsaApiResponse;

    const rawScores = body.scores;
    const scores: FsaScores | null =
      rawScores &&
      typeof rawScores.Hygiene === "number" &&
      typeof rawScores.Structural === "number" &&
      typeof rawScores.ConfidenceInManagement === "number"
        ? {
            hygiene: rawScores.Hygiene,
            structural: rawScores.Structural,
            confidenceInManagement: rawScores.ConfidenceInManagement,
          }
        : null;

    return {
      phone: nullableString(body.Phone),
      rightToReply: nullableString(body.RightToReply),
      newRatingPending: body.NewRatingPending === true,
      scores,
    };
  } catch {
    // Timed out, network error, unexpected shape, etc. — the FSA's live API is a "nice
    // to have" enrichment, so any failure here just means we show less, not an error page.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
