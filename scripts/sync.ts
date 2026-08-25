import "dotenv/config";
import { Readable } from "node:stream";
import { parse } from "csv-parse";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

const CSV_URL = "https://ratings.food.gov.uk/api/open-data-files/FHRS_All_en-GB.csv";
const BATCH_SIZE = 500;
const PROGRESS_INTERVAL = 50_000;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env before running the sync.");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface CsvRecord {
  AddressLine1?: string;
  AddressLine2?: string;
  AddressLine3?: string;
  AddressLine4?: string;
  BusinessTypeID?: string;
  FHRSID?: string;
  BusinessName?: string;
  BusinessType?: string;
  Latitude?: string;
  LocalAuthorityBusinessID?: string;
  LocalAuthorityCode?: string;
  LocalAuthorityName?: string;
  Longitude?: string;
  PostCode?: string;
  RatingDate?: string;
  RatingKey?: string;
  RatingValue?: string;
  SchemeType?: string;
}

interface MappedRow {
  fhrsId: number;
  localAuthorityBusinessId: string;
  businessName: string;
  businessType: string;
  businessTypeId: number;
  addressLine1: string | null;
  addressLine2: string | null;
  addressLine3: string | null;
  addressLine4: string | null;
  postcode: string | null;
  ratingValue: string;
  ratingKey: string;
  ratingDate: Date | null;
  schemeType: string;
  latitude: number | null;
  longitude: number | null;
  localAuthorityName: string;
  localAuthorityCode: string;
}

function nullableString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function nullableFloat(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableDate(value: string | undefined): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// FHRSID and BusinessTypeID are the only fields we treat as hard requirements —
// everything else in the feed is allowed to be sparse or missing.
function mapRow(record: CsvRecord): MappedRow | null {
  const fhrsId = Number.parseInt(record.FHRSID ?? "", 10);
  const businessTypeId = Number.parseInt(record.BusinessTypeID ?? "", 10);
  if (!Number.isInteger(fhrsId) || !Number.isInteger(businessTypeId)) {
    return null;
  }

  return {
    fhrsId,
    localAuthorityBusinessId: record.LocalAuthorityBusinessID?.trim() ?? "",
    businessName: record.BusinessName?.trim() ?? "",
    businessType: record.BusinessType?.trim() ?? "",
    businessTypeId,
    addressLine1: nullableString(record.AddressLine1),
    addressLine2: nullableString(record.AddressLine2),
    addressLine3: nullableString(record.AddressLine3),
    addressLine4: nullableString(record.AddressLine4),
    postcode: nullableString(record.PostCode),
    ratingValue: record.RatingValue?.trim() ?? "",
    ratingKey: record.RatingKey?.trim() ?? "",
    ratingDate: nullableDate(record.RatingDate),
    schemeType: record.SchemeType?.trim() ?? "",
    latitude: nullableFloat(record.Latitude),
    longitude: nullableFloat(record.Longitude),
    localAuthorityName: record.LocalAuthorityName?.trim() ?? "",
    localAuthorityCode: record.LocalAuthorityCode?.trim() ?? "",
  };
}

function rowTuple(row: MappedRow, syncRunAt: Date) {
  return Prisma.sql`(${row.fhrsId}, ${row.localAuthorityBusinessId}, ${row.businessName}, ${row.businessType}, ${row.businessTypeId}, ${row.addressLine1}, ${row.addressLine2}, ${row.addressLine3}, ${row.addressLine4}, ${row.postcode}, ${row.ratingValue}, ${row.ratingKey}, ${row.ratingDate}, ${row.schemeType}, ${row.latitude}, ${row.longitude}, ${row.localAuthorityName}, ${row.localAuthorityCode}, true, ${syncRunAt}, ${syncRunAt})`;
}

interface PriorRating {
  ratingValue: string;
  ratingDate: Date | null;
}

function ratingChanged(prior: PriorRating | undefined, row: MappedRow): boolean {
  if (!prior) return true; // brand new establishment — seed its history baseline
  if (prior.ratingValue !== row.ratingValue) return true;
  const priorTime = prior.ratingDate?.getTime() ?? null;
  const nextTime = row.ratingDate?.getTime() ?? null;
  return priorTime !== nextTime; // a new ratingDate means a re-inspection occurred
}

// Bulk INSERT .. ON CONFLICT DO UPDATE in a single round trip per batch, matched on the
// FSA's stable fhrsId. `xmax = 0` on the returned row distinguishes a fresh insert from
// an update of an existing row, so we can report both counts without a second query.
//
// Also detects rating changes (including first-seen establishments) by comparing against
// a snapshot of prior ratingValue/ratingDate taken just before the upsert, and writes one
// RatingHistory row per change — this is what powers the "rating history" timeline on the
// establishment detail page.
async function upsertBatch(
  batch: MappedRow[],
  syncRunAt: Date,
): Promise<{ added: number; updated: number; historyRows: number }> {
  if (batch.length === 0) return { added: 0, updated: 0, historyRows: 0 };

  const fhrsIds = batch.map((row) => row.fhrsId);
  const priorRows = await prisma.establishment.findMany({
    where: { fhrsId: { in: fhrsIds } },
    select: { fhrsId: true, ratingValue: true, ratingDate: true },
  });
  const priorByFhrsId = new Map<number, PriorRating>(
    priorRows.map((row) => [row.fhrsId, { ratingValue: row.ratingValue, ratingDate: row.ratingDate }]),
  );

  const result = await prisma.$queryRaw<{ isNew: boolean }[]>`
    INSERT INTO "Establishment" (
      "fhrsId", "localAuthorityBusinessId", "businessName", "businessType", "businessTypeId",
      "addressLine1", "addressLine2", "addressLine3", "addressLine4", "postcode",
      "ratingValue", "ratingKey", "ratingDate", "schemeType",
      "latitude", "longitude",
      "localAuthorityName", "localAuthorityCode",
      "isActive", "lastSeenAt", "updatedAt"
    )
    VALUES ${Prisma.join(batch.map((row) => rowTuple(row, syncRunAt)))}
    ON CONFLICT ("fhrsId") DO UPDATE SET
      "localAuthorityBusinessId" = EXCLUDED."localAuthorityBusinessId",
      "businessName" = EXCLUDED."businessName",
      "businessType" = EXCLUDED."businessType",
      "businessTypeId" = EXCLUDED."businessTypeId",
      "addressLine1" = EXCLUDED."addressLine1",
      "addressLine2" = EXCLUDED."addressLine2",
      "addressLine3" = EXCLUDED."addressLine3",
      "addressLine4" = EXCLUDED."addressLine4",
      "postcode" = EXCLUDED."postcode",
      "ratingValue" = EXCLUDED."ratingValue",
      "ratingKey" = EXCLUDED."ratingKey",
      "ratingDate" = EXCLUDED."ratingDate",
      "schemeType" = EXCLUDED."schemeType",
      "latitude" = EXCLUDED."latitude",
      "longitude" = EXCLUDED."longitude",
      "localAuthorityName" = EXCLUDED."localAuthorityName",
      "localAuthorityCode" = EXCLUDED."localAuthorityCode",
      "isActive" = true,
      "lastSeenAt" = EXCLUDED."lastSeenAt",
      "updatedAt" = EXCLUDED."updatedAt"
    RETURNING (xmax = 0) AS "isNew"
  `;

  const added = result.filter((row) => row.isNew).length;

  const changedRows = batch.filter((row) => ratingChanged(priorByFhrsId.get(row.fhrsId), row));
  if (changedRows.length > 0) {
    await prisma.ratingHistory.createMany({
      data: changedRows.map((row) => ({
        fhrsId: row.fhrsId,
        ratingValue: row.ratingValue,
        schemeType: row.schemeType,
        ratingDate: row.ratingDate,
        recordedAt: syncRunAt,
      })),
    });
  }

  return { added, updated: result.length - added, historyRows: changedRows.length };
}

async function main() {
  // Fixed once per run: every row touched in this run gets exactly this lastSeenAt,
  // so "not updated in this run" is a simple `lastSeenAt < syncRunAt` comparison,
  // regardless of how long the run takes.
  const syncRunAt = new Date();
  console.log(`Starting FSA data sync at ${syncRunAt.toISOString()}`);
  console.log(`Downloading ${CSV_URL}`);

  const response = await fetch(CSV_URL);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download CSV: ${response.status} ${response.statusText}`);
  }

  const parser = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>).pipe(
    parse({
      columns: true,
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }),
  );

  let totalRows = 0;
  let skippedRows = 0;
  let added = 0;
  let updated = 0;
  let historyRows = 0;
  let batch: MappedRow[] = [];

  for await (const record of parser as AsyncIterable<CsvRecord>) {
    totalRows++;
    const mapped = mapRow(record);
    if (!mapped) {
      skippedRows++;
      continue;
    }
    batch.push(mapped);

    if (batch.length >= BATCH_SIZE) {
      const result = await upsertBatch(batch, syncRunAt);
      added += result.added;
      updated += result.updated;
      historyRows += result.historyRows;
      batch = [];
    }

    if (totalRows % PROGRESS_INTERVAL === 0) {
      console.log(`  ...${totalRows.toLocaleString()} rows processed`);
    }
  }

  if (batch.length > 0) {
    const result = await upsertBatch(batch, syncRunAt);
    added += result.added;
    updated += result.updated;
    historyRows += result.historyRows;
  }

  console.log("Marking establishments no longer present in the feed as inactive...");
  const deactivated = await prisma.establishment.updateMany({
    where: { isActive: true, lastSeenAt: { lt: syncRunAt } },
    data: { isActive: false },
  });

  console.log("\nSync complete");
  console.log(`  Rows processed:          ${totalRows.toLocaleString()}`);
  console.log(`  Rows skipped (bad data): ${skippedRows.toLocaleString()}`);
  console.log(`  New establishments:      ${added.toLocaleString()}`);
  console.log(`  Updated establishments:  ${updated.toLocaleString()}`);
  console.log(`  Rating history rows:     ${historyRows.toLocaleString()}`);
  console.log(`  Newly marked inactive:   ${deactivated.count.toLocaleString()}`);
}

main()
  .catch((err) => {
    console.error("Sync failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
