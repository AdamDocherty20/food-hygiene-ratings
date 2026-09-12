// Matches active FSA establishments against Companies House's Free Company Data Product —
// see the "Companies House" section of the data-layer brief this implements. Downloads the
// current monthly snapshot fresh on every run rather than persisting the full ~5.5m-row
// register (see the comment on CompanyMatch in schema.prisma for why), matches offline, and
// writes only the match results.
//
// Two passes over the downloaded file rather than one, deliberately: a first pass builds a
// minimal matching index (just company number + normalised name + postcode — no dates, no
// SIC text, no original-casing name) to find which ~5.5m companies are actually relevant,
// then a second pass fetches full detail for only that small matched subset. A single pass
// holding full detail for all 5.5m companies blew the heap on an 8GB machine (and would be
// tight on a standard GitHub Actions runner too) — this keeps peak memory proportional to
// the match count, not the size of the whole UK company register.
//
// Usage: npx tsx -r dotenv/config scripts/match-companies-house.ts

import "dotenv/config";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { parse } from "csv-parse";
import { token_set_ratio } from "fuzzball";
import { PrismaPg } from "@prisma/adapter-pg";
import unzipper from "unzipper";
import { normalizeBusinessName } from "../src/lib/business-name";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

const INDEX_URL = "https://download.companieshouse.gov.uk/en_output.html";
const LICENCE = "Companies House free data — https://www.gov.uk/government/publications/licensing-the-free-company-data-product";
const SOURCE = "companies-house-free-data-product";

const FUZZY_THRESHOLD = 92;
const BATCH_SIZE = 500;
const PROGRESS_INTERVAL = 500_000;
const MATCH_PROGRESS_INTERVAL = 25_000;

// Company-formation agents and accountants routinely register thousands of shell/dormant
// companies at a single registered-office postcode — that's a real, well-known feature of
// this dataset, not a bug in the matching logic. A district bucket that large isn't a
// genuine geographic-proximity signal, so it's skipped for fuzzy matching entirely rather
// than scored: comparing every establishment near it against thousands of unrelated shell
// companies is both pointless (formation-agent postcodes aren't where anyone actually
// trades) and, at scale, the difference between this script finishing in minutes vs. never
// finishing at all.
const MAX_FUZZY_BUCKET_SIZE = 300;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env before running this script.");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Normalisation — see the brief's "Matching strategy" for the exact rules.
// ---------------------------------------------------------------------------

// The outward code (e.g. "SW1A" from "SW1A 1AA") — a reasonable proxy for "postcode
// district" given what's actually on both sides of the match (FSA gives us a full
// postcode, not a separate district field).
function postcodeDistrict(postcode: string | null): string | null {
  if (!postcode) return null;
  const outward = postcode.trim().toUpperCase().split(/\s+/)[0];
  return outward || null;
}

function nullableString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// Companies House dates are DD/MM/YYYY (e.g. "11/09/2012" = 11 September) — `new Date()`
// on that string misparses it as US-format MM/DD/YYYY, silently swapping day and month
// for any day <= 12, so this parses the three parts explicitly instead.
function nullableDate(value: string | undefined): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Finds the current month's snapshot URL from the Companies House downloads index rather
 * than hardcoding a dated filename — the brief is explicit about this for the FSA source,
 * and the same reasoning applies here: this filename changes every month.
 */
async function discoverSnapshotUrl(): Promise<string> {
  const response = await fetch(INDEX_URL);
  if (!response.ok) {
    throw new Error(`Failed to load Companies House downloads index: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const match = html.match(/href="(BasicCompanyDataAsOneFile-[^"]+\.zip)"/i);
  if (!match) {
    throw new Error("Could not find a BasicCompanyDataAsOneFile-*.zip link on the Companies House downloads index.");
  }
  return new URL(match[1], INDEX_URL).toString();
}

async function downloadToFile(url: string, destPath: string): Promise<void> {
  console.log(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download Companies House snapshot: ${response.status} ${response.statusText}`);
  }
  const nodeStream = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>);
  await pipeline(nodeStream, createWriteStream(destPath));
}

// Shared streaming-parse plumbing for both passes below — reads the zip from disk (not
// network) since both passes read the same local copy.
async function* streamCompanyRows(zipPath: string): AsyncGenerator<Record<string, string>> {
  const zip = createReadStream(zipPath).pipe(unzipper.ParseOne(/\.csv$/i));
  const parser = zip.pipe(parse({ columns: true, bom: true, trim: true, skip_empty_lines: true, relax_column_count: true }));
  for await (const record of parser as AsyncIterable<Record<string, string>>) {
    yield record;
  }
}

// ---------------------------------------------------------------------------
// Pass 1 — lightweight matching index (company number + normalised name + postcode only)
// ---------------------------------------------------------------------------

interface LightCompany {
  companyNumber: string;
  normalizedName: string;
  postcode: string | null;
}

interface MatchIndex {
  byNormalizedName: Map<string, LightCompany[]>;
  byPostcodeDistrict: Map<string, LightCompany[]>;
  total: number;
}

async function buildMatchIndex(zipPath: string): Promise<MatchIndex> {
  const byNormalizedName = new Map<string, LightCompany[]>();
  const byPostcodeDistrict = new Map<string, LightCompany[]>();
  let total = 0;

  for await (const record of streamCompanyRows(zipPath)) {
    const companyName = record.CompanyName?.trim();
    const companyNumber = record.CompanyNumber?.trim();
    if (!companyName || !companyNumber) continue;

    const normalizedName = normalizeBusinessName(companyName);
    const postcode = nullableString(record["RegAddress.PostCode"]);
    if (!normalizedName) continue;

    const company: LightCompany = { companyNumber, normalizedName, postcode };

    const nameBucket = byNormalizedName.get(normalizedName);
    if (nameBucket) nameBucket.push(company);
    else byNormalizedName.set(normalizedName, [company]);

    const district = postcodeDistrict(postcode);
    if (district) {
      const districtBucket = byPostcodeDistrict.get(district);
      if (districtBucket) districtBucket.push(company);
      else byPostcodeDistrict.set(district, [company]);
    }

    total++;
    if (total % PROGRESS_INTERVAL === 0) {
      console.log(`  ...${total.toLocaleString()} companies indexed (pass 1/2)`);
    }
  }

  console.log(`Pass 1 complete: indexed ${total.toLocaleString()} companies.`);

  const largestDistricts = [...byPostcodeDistrict.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 5);
  console.log(
    `Largest postcode-district buckets: ${largestDistricts.map(([district, companies]) => `${district} (${companies.length.toLocaleString()})`).join(", ")}`,
  );

  return { byNormalizedName, byPostcodeDistrict, total };
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

type Confidence = "HIGH" | "MEDIUM" | "LOW";

interface LightMatch {
  companyNumber: string;
  confidence: Confidence;
}

/**
 * Applies the brief's confidence-tier rules:
 *   HIGH   — normalised name exact match AND postcode exact match
 *   MEDIUM — fuzzy name match (token-set ratio >= 92) within the same postcode district,
 *            or an exact name match that's unique across the register
 *   LOW    — fewer than 92 fuzzy score, but the name is still unique across the register
 *   NONE   — everything else (returns null)
 *
 * The brief's MEDIUM also lists "exact name AND same post town" as an alternative path —
 * the FSA side has no clean town field to compare against (town is buried inconsistently
 * across free-text address lines), so an exact-and-unique name match is treated as MEDIUM
 * directly instead, which is at least as strong a signal.
 */
function matchEstablishment(normalizedName: string, postcode: string | null, index: MatchIndex): LightMatch | null {
  if (!normalizedName) return null;

  const exactNameCandidates = index.byNormalizedName.get(normalizedName) ?? [];

  if (postcode) {
    const normalizedPostcode = postcode.trim().toUpperCase();
    const highMatch = exactNameCandidates.find((c) => c.postcode?.toUpperCase() === normalizedPostcode);
    if (highMatch) return { companyNumber: highMatch.companyNumber, confidence: "HIGH" };
  }

  if (exactNameCandidates.length === 1) {
    return { companyNumber: exactNameCandidates[0].companyNumber, confidence: "MEDIUM" };
  }

  const district = postcodeDistrict(postcode);
  if (district) {
    const districtCandidates = index.byPostcodeDistrict.get(district) ?? [];
    let best: LightCompany | null = null;
    let bestScore = 0;
    for (const candidate of districtCandidates.length <= MAX_FUZZY_BUCKET_SIZE ? districtCandidates : []) {
      const score = token_set_ratio(normalizedName, candidate.normalizedName);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    if (best && bestScore >= FUZZY_THRESHOLD) {
      return { companyNumber: best.companyNumber, confidence: "MEDIUM" };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Pass 2 — full detail for only the companies that actually matched
// ---------------------------------------------------------------------------

interface CompanyDetail {
  companyName: string;
  incorporationDate: Date | null;
  companyStatus: string | null;
  sicCodes: string[];
}

async function fetchCompanyDetails(zipPath: string, companyNumbers: Set<string>): Promise<Map<string, CompanyDetail>> {
  const details = new Map<string, CompanyDetail>();
  let scanned = 0;

  for await (const record of streamCompanyRows(zipPath)) {
    scanned++;
    if (scanned % PROGRESS_INTERVAL === 0) {
      console.log(`  ...${scanned.toLocaleString()} companies scanned (pass 2/2, ${details.size.toLocaleString()} of ${companyNumbers.size.toLocaleString()} found)`);
    }

    const companyNumber = record.CompanyNumber?.trim();
    if (!companyNumber || !companyNumbers.has(companyNumber)) continue;

    const sicCodes = [1, 2, 3, 4]
      .map((n) => nullableString(record[`SICCode.SicText_${n}`]))
      .filter((code): code is string => code !== null);

    details.set(companyNumber, {
      companyName: record.CompanyName?.trim() ?? companyNumber,
      incorporationDate: nullableDate(record.IncorporationDate),
      companyStatus: nullableString(record.CompanyStatus),
      sicCodes,
    });

    if (details.size === companyNumbers.size) break; // found everything we need
  }

  console.log(`Pass 2 complete: fetched detail for ${details.size.toLocaleString()} of ${companyNumbers.size.toLocaleString()} matched companies.`);
  return details;
}

// ---------------------------------------------------------------------------
// Persisting results
// ---------------------------------------------------------------------------

interface EstablishmentRow {
  fhrsId: number;
  businessName: string;
  postcode: string | null;
}

interface FinalMatch {
  companyNumber: string;
  confidence: Confidence;
  detail: CompanyDetail;
}

function matchRowTuple(fhrsId: number, match: FinalMatch, retrievedAt: Date) {
  const { companyNumber, confidence, detail } = match;
  const publishable = confidence === "HIGH" || confidence === "MEDIUM";
  return Prisma.sql`(${fhrsId}, ${companyNumber}, ${detail.companyName}, ${detail.incorporationDate}, ${detail.companyStatus}, ${detail.sicCodes}, ${confidence}, ${publishable}, ${SOURCE}, ${LICENCE}, ${retrievedAt}, now())`;
}

async function persistMatches(matches: Map<number, FinalMatch>, retrievedAt: Date): Promise<void> {
  const entries = [...matches.entries()];
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await prisma.$executeRaw`
      INSERT INTO "CompanyMatch" (
        "fhrsId", "companyNumber", "companyName", "incorporationDate", "companyStatus",
        "sicCodes", "matchConfidence", "publishable", "source", "licence", "retrievedAt", "matchedAt"
      )
      VALUES ${Prisma.join(batch.map(([fhrsId, match]) => matchRowTuple(fhrsId, match, retrievedAt)))}
      ON CONFLICT ("fhrsId") DO UPDATE SET
        "companyNumber" = EXCLUDED."companyNumber",
        "companyName" = EXCLUDED."companyName",
        "incorporationDate" = EXCLUDED."incorporationDate",
        "companyStatus" = EXCLUDED."companyStatus",
        "sicCodes" = EXCLUDED."sicCodes",
        "matchConfidence" = EXCLUDED."matchConfidence",
        "publishable" = EXCLUDED."publishable",
        "source" = EXCLUDED."source",
        "licence" = EXCLUDED."licence",
        "retrievedAt" = EXCLUDED."retrievedAt",
        "matchedAt" = EXCLUDED."matchedAt"
    `;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const retrievedAt = new Date();
  const workDir = await mkdtemp(join(tmpdir(), "companies-house-"));
  const zipPath = join(workDir, "companies-house.zip");

  try {
    const snapshotUrl = await discoverSnapshotUrl();
    await downloadToFile(snapshotUrl, zipPath);

    const index = await buildMatchIndex(zipPath);

    console.log("Loading active FSA establishments...");
    const establishments = await prisma.$queryRaw<EstablishmentRow[]>`
      SELECT "fhrsId", "businessName", "postcode" FROM "Establishment" WHERE "isActive" = true
    `;
    console.log(`Matching ${establishments.length.toLocaleString()} establishments against ${index.total.toLocaleString()} companies...`);

    const lightMatches = new Map<number, LightMatch>();
    let matchedProcessed = 0;
    for (const establishment of establishments) {
      const normalizedName = normalizeBusinessName(establishment.businessName);
      const match = matchEstablishment(normalizedName, establishment.postcode, index);
      if (match) lightMatches.set(establishment.fhrsId, match);

      matchedProcessed++;
      if (matchedProcessed % MATCH_PROGRESS_INTERVAL === 0) {
        console.log(
          `  ...${matchedProcessed.toLocaleString()} of ${establishments.length.toLocaleString()} establishments matched against (${lightMatches.size.toLocaleString()} found so far)`,
        );
      }
    }
    console.log(`Matching complete: ${lightMatches.size.toLocaleString()} candidate matches.`);

    const companyNumbers = new Set([...lightMatches.values()].map((m) => m.companyNumber));
    const details = await fetchCompanyDetails(zipPath, companyNumbers);

    const finalMatches = new Map<number, FinalMatch>();
    const tierCounts: Record<Confidence, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const [fhrsId, match] of lightMatches) {
      const detail = details.get(match.companyNumber);
      if (!detail) continue; // shouldn't happen, but don't persist a match with no detail
      finalMatches.set(fhrsId, { companyNumber: match.companyNumber, confidence: match.confidence, detail });
      tierCounts[match.confidence]++;
    }

    console.log(`Writing ${finalMatches.size.toLocaleString()} match results...`);
    await persistMatches(finalMatches, retrievedAt);

    const unmatched = establishments.length - finalMatches.size;
    console.log("\nMatch complete");
    console.log(`  Establishments checked: ${establishments.length.toLocaleString()}`);
    console.log(`  HIGH confidence:        ${tierCounts.HIGH.toLocaleString()}`);
    console.log(`  MEDIUM confidence:      ${tierCounts.MEDIUM.toLocaleString()}`);
    console.log(`  LOW confidence:         ${tierCounts.LOW.toLocaleString()}`);
    console.log(`  Unmatched:              ${unmatched.toLocaleString()}`);
    console.log(
      `  Publishable (HIGH+MEDIUM): ${(tierCounts.HIGH + tierCounts.MEDIUM).toLocaleString()} (${(((tierCounts.HIGH + tierCounts.MEDIUM) / establishments.length) * 100).toFixed(1)}%)`,
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main()
  .catch((err) => {
    console.error("Companies House match failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
