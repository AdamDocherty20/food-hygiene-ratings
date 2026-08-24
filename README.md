This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## API

Read-only JSON API for the UK Food Standards Agency FHRS/FHIS data synced into the
`Establishment` table via `npm run sync`. There is no UI or authentication yet — these
routes are meant to be hit directly (curl / browser / Postman) while the frontend is
built against them.

All endpoints only return establishments with `isActive: true` — i.e. establishments
still present in the FSA's current feed. Every error response is JSON in the shape
`{ "error": "..." }`, with an appropriate 4xx/5xx status code; malformed input never
produces an unhandled 500.

Every route is also rate-limited per IP (60 requests/minute; over that returns `429`
with a `Retry-After` header). This is an in-memory limiter, so it only meaningfully
protects a single long-lived server process — see `src/lib/rate-limit.ts` for the
serverless caveat.

Paginated endpoints (`search`, `nearby`) share the same `page` / `pageSize` params and
response shape:

- `page` — 1-indexed, default `1`
- `pageSize` — default `20`, capped at `100` (a `pageSize` above 100 is a 400, not a
  silent clamp)
- Response includes a `pagination` object: `{ page, pageSize, total, totalPages }`

### `GET /api/establishments/search`

Search establishments by any combination of the following query params (all optional,
combined with AND):

| Param | Type | Match |
|---|---|---|
| `name` | string | case-insensitive partial match on `businessName` |
| `postcode` | string | case-insensitive partial match on `postcode` |
| `businessTypeId` | integer | exact match |
| `ratingValue` | string | exact match (covers both `"5"` and `"Pass"`) |
| `localAuthorityName` | string | case-insensitive partial match |
| `page`, `pageSize` | integer | pagination (see above) |

**Example**

```
GET /api/establishments/search?name=starbucks&pageSize=2
```

```json
{
  "data": [
    {
      "id": 358481,
      "fhrsId": 1971091,
      "localAuthorityBusinessId": "53715",
      "businessName": "ARAMARK AT BROCKENHURST COLLEGE STARBUCKS",
      "businessType": "Restaurant/Cafe/Canteen",
      "businessTypeId": 1,
      "addressLine1": "LYNDHURST ROAD",
      "addressLine2": "BROCKENHURST",
      "addressLine3": null,
      "addressLine4": null,
      "postcode": "SO42 7ZE",
      "ratingValue": "AwaitingInspection",
      "ratingKey": "fhrs_awaitinginspection_en-GB",
      "ratingDate": null,
      "schemeType": "FHRS",
      "latitude": 50.81834116,
      "longitude": -1.57202956,
      "localAuthorityName": "New Forest",
      "localAuthorityCode": "138",
      "isActive": true,
      "lastSeenAt": "2026-08-24T09:25:53.295Z",
      "createdAt": "2026-08-24T09:20:24.091Z",
      "updatedAt": "2026-08-24T09:25:53.295Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 2, "total": 47, "totalPages": 24 }
}
```

Errors: `400` for an invalid `businessTypeId`, `page`, or `pageSize`.

### `GET /api/establishments/[id]`

Look up a single establishment by **`fhrsId`** (the FSA's stable national ID — not the
internal database `id`). Returns `404` if no establishment has that `fhrsId`, or if it
exists but `isActive` is `false`.

**Example**

```
GET /api/establishments/1954128
```

```json
{
  "data": {
    "id": 335826,
    "fhrsId": 1954128,
    "businessName": "!NOSH!",
    "ratingValue": "Pass",
    "schemeType": "FHIS",
    "isActive": true
    /* ...remaining fields as above */
  }
}
```

```
GET /api/establishments/999999999
```

```json
{ "error": "No active establishment found with fhrsId 999999999." }
```

`404`. A non-integer `id` (e.g. `/api/establishments/abc`) returns `400`.

### `GET /api/establishments/nearby`

Find establishments within a radius of a point, sorted nearest-first. Distance is
computed with the Haversine formula in raw SQL (no PostGIS dependency), with a
bounding-box pre-filter so the (latitude, longitude) index can narrow candidates before
the exact distance check runs.

| Param | Type | Notes |
|---|---|---|
| `lat` | number | **required**, `-90`..`90` |
| `lng` | number | **required**, `-180`..`180` |
| `radiusMiles` | number | optional, default `1`, capped at `10` |
| `page`, `pageSize` | integer | pagination (see above) |

Only establishments with non-null `latitude`/`longitude` (and `isActive: true`) are
considered. Each result includes a computed `distanceMiles`.

**Example**

```
GET /api/establishments/nearby?lat=51.5074&lng=-0.1278&radiusMiles=1&pageSize=1
```

```json
{
  "data": [
    {
      "id": 174178,
      "fhrsId": 411203,
      "businessName": "Caffe Nero",
      "postcode": "WC2N 5DS",
      "ratingValue": "5",
      "latitude": 51.507232,
      "longitude": -0.1284841,
      "isActive": true,
      "distanceMiles": 0.03162865525014185
      /* ...remaining fields as above */
    }
  ],
  "pagination": { "page": 1, "pageSize": 1, "total": 4123, "totalPages": 4123 },
  "query": { "lat": 51.5074, "lng": -0.1278, "radiusMiles": 1 }
}
```

Errors: `400` for a missing/out-of-range `lat` or `lng`, or an invalid `radiusMiles`
(a `radiusMiles` above 10 is silently capped, not rejected — only non-numeric or
non-positive values are a 400).

### `GET /api/establishments/business-types`

Returns the distinct `businessTypeId` / `businessType` pairs present among active
establishments, sorted alphabetically by `businessType`. Used to populate the business
type dropdown on the search page.

**Example**

```
GET /api/establishments/business-types
```

```json
{
  "data": [
    { "businessTypeId": 7841, "businessType": "Distributors/Transporters" },
    { "businessTypeId": 1, "businessType": "Restaurant/Cafe/Canteen" }
  ]
}
```

## Frontend

Two pages, both built against the API routes above (no direct Prisma access from
page/component code):

- **`/`** — search page. A form (business name, postcode, business type dropdown)
  updates the URL's query string on submit, so searches are shareable/bookmarkable and
  work with the browser back/forward buttons. Results render as a list (name, address,
  rating badge with date) alongside a Leaflet/OpenStreetMap map that drops a marker for
  every result with coordinates — results without coordinates just don't get a marker.
  Clicking a result card or a map marker navigates to that establishment's detail page.
  Pagination controls are wired to the search API's `page`/`pageSize`.
- **`/establishment/[id]`** — detail page, looked up by `fhrsId`. Shows business name,
  full address, business type, rating (with date), and local authority, plus a
  single-point map — omitted entirely (not a broken/empty map) if the establishment has
  no coordinates.

Both pages share a `RatingBadge` component that branches on `schemeType`: FHRS shows
the numeric value on a red (0-1) / amber (2-3) / green (4-5) scale, FHIS shows a text
status badge (Pass / Improvement Required / Exempt / Awaiting Publication). Some FHRS
rows also carry a non-numeric status (e.g. `AwaitingInspection`, `Exempt`) — those fall
back to a neutral badge rather than a numeric scale. The rating date is always shown
next to the badge, on every page — this is an Open Government Licence attribution
requirement, not just a UX nicety.

Every page includes a footer with the required FSA/OGL attribution line and links to
[ratings.food.gov.uk](https://ratings.food.gov.uk) and the
[OGL v3.0 licence text](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).

No auth, favourites, or admin features yet.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploying

The easiest path is the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js — connect the repo, it detects Next.js automatically, and a custom domain is a few minutes' work in the project's Domains settings (add the domain, then add the DNS record it gives you at your registrar). Any other Next.js-capable host works too; the notes below apply regardless of where it's hosted.

**Environment variables to set on the host:**

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | See "pooled connection" below — don't reuse the direct connection string from local `.env` on a serverless host. |
| `NEXT_PUBLIC_SITE_URL` | recommended | Your real domain, e.g. `https://example.com`. Used for Open Graph tags, `robots.txt`, and the sitemap. Defaults to `http://localhost:3000` if unset. |
| `NEXT_PUBLIC_TILE_URL` / `NEXT_PUBLIC_TILE_ATTRIBUTION` | optional | Override the map tile source (see below). Both default to the free OpenStreetMap tiles if unset. |

**Use Neon's pooled connection string in production.** The `DATABASE_URL` in local `.env` points at Neon's *direct* endpoint, which is fine for a single long-lived process (dev server, the sync script) but will exhaust Neon's connection limit under serverless traffic, where every function invocation can open its own connection. In the Neon dashboard, copy the *pooled* connection string instead (same credentials, hostname has `-pooler` in it) and use that as `DATABASE_URL` on the hosting platform.

**Keep the data fresh.** `npm run sync` is still manual-only — nothing re-runs it automatically. `.github/workflows/sync.yml` runs it daily via GitHub Actions (host-agnostic, works no matter where the app itself is deployed) once the repo is pushed to GitHub and a `DATABASE_URL` secret is added under Settings → Secrets and variables → Actions. Without that secret, the workflow will fail — either add it or disable the workflow if you'd rather sync manually.

**Map tiles.** The map defaults to the free `tile.openstreetmap.org` servers, which is fine for casual/dev traffic, but OSM's usage policy asks higher-volume sites to move to a paid provider (MapTiler, Stadia Maps, Mapbox, etc.) instead of hot-linking their free tiles. If this gets real traffic, sign up with one of those, then set `NEXT_PUBLIC_TILE_URL` and `NEXT_PUBLIC_TILE_ATTRIBUTION` to the values they give you — no code change needed.

**Not included yet:** a shared (cross-instance) rate limit store, and any monitoring/error tracking. Fine for a modest public launch; worth revisiting if traffic grows a lot.
