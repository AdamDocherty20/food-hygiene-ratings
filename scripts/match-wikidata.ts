// Matches active FSA establishments against UK restaurant/café/pub/supermarket/bakery
// chains on Wikidata — see the "Wikidata" section of the data-layer brief this implements.
//
// Unlike Companies House (a ~5.5m-row register), there are only ~231 UK chains in the
// classes queried below, so the whole list is fetched in one SPARQL query and held in
// memory — no need for the two-pass/streaming approach match-companies-house.ts uses.
//
// Matching is exact-name-or-alias only, deliberately: the brief is explicit that fuzzy
// matching here is dangerous ("Costa Coffee Ltd is Costa; The Costa Del Sol Fish Bar is
// not"), and unlike Companies House there's no postcode to cross-check against — a chain
// name is either an exact match to the FSA business name (after normalising) or it isn't.
//
// Usage: npx tsx -r dotenv/config scripts/match-wikidata.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizeBusinessName } from "../src/lib/business-name";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const LICENCE = "Wikidata (CC0) — https://www.wikidata.org/wiki/Wikidata:Licensing";
const SOURCE = "wikidata";
const BATCH_SIZE = 500;
const MATCH_PROGRESS_INTERVAL = 100_000;

// UK restaurant/café/pub/supermarket/bakery/convenience-store chain classes — verified
// against the live SPARQL endpoint rather than guessed (see the commit this shipped in for
// the verification queries): restaurant chain, fast food restaurant chain, café chain,
// supermarket chain, bakery chain, pub chain, convenience store chain.
const CHAIN_CLASSES = ["Q18534542", "Q18509232", "Q76212517", "Q18043413", "Q63869263", "Q7257246", "Q76213979"];

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env before running this script.");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface ChainInfo {
  wikidataId: string;
  chainName: string;
  foundedDate: Date | null;
  headquarters: string | null;
  website: string | null;
}

interface SparqlBinding {
  item: { value: string };
  itemLabel?: { value: string };
  founded?: { value: string };
  site?: { value: string };
  hq?: { value: string };
  aliases?: { value: string };
}

function nullableDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * One SPARQL query, aggregated with SAMPLE()/GROUP_CONCAT so multi-valued properties
 * (a chain can have several websites, several inception-date claims, etc.) don't produce a
 * combinatorial cross-product of rows — this bit it on the first attempt at this query.
 */
async function fetchUkChains(): Promise<{ chain: ChainInfo; aliases: string[] }[]> {
  const query = `
    SELECT ?item ?itemLabel (SAMPLE(?inception) AS ?founded) (SAMPLE(?website) AS ?site)
           (SAMPLE(?hqLabel) AS ?hq) (GROUP_CONCAT(DISTINCT ?alias; separator="|") AS ?aliases)
    WHERE {
      VALUES ?class { wd:${CHAIN_CLASSES.join(" wd:")} }
      ?item wdt:P31 ?class .
      ?item wdt:P17 wd:Q145 .
      OPTIONAL { ?item wdt:P571 ?inception }
      OPTIONAL { ?item wdt:P856 ?website }
      OPTIONAL { ?item wdt:P159 ?hq . ?hq rdfs:label ?hqLabel . FILTER(LANG(?hqLabel) = "en") }
      OPTIONAL { ?item skos:altLabel ?alias . FILTER(LANG(?alias) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    GROUP BY ?item ?itemLabel
  `;

  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "ShouldIEatHere/1.0 (https://adamdocherty.com; food hygiene rating site)",
    },
  });
  if (!response.ok) {
    throw new Error(`Wikidata SPARQL query failed: ${response.status} ${response.statusText}`);
  }
  const body = (await response.json()) as { results: { bindings: SparqlBinding[] } };

  return body.results.bindings
    .filter((b) => b.itemLabel?.value)
    .map((b) => ({
      chain: {
        wikidataId: b.item.value.split("/").pop() ?? "",
        chainName: b.itemLabel!.value,
        foundedDate: nullableDate(b.founded?.value),
        headquarters: b.hq?.value ?? null,
        website: b.site?.value ?? null,
      },
      aliases: b.aliases?.value ? b.aliases.value.split("|").filter(Boolean) : [],
    }));
}

/**
 * Builds a normalised-name -> chain lookup from every chain's own name plus its aliases.
 * If two different chains normalise to the same key (hasn't happened with the current
 * ~231-chain list, but the data could change), that key is marked ambiguous and excluded
 * entirely — guessing which chain a colliding name "really" means is exactly the kind of
 * mistake the brief's strictness requirement is warning against.
 */
function buildChainIndex(chains: { chain: ChainInfo; aliases: string[] }[]): Map<string, ChainInfo | null> {
  const index = new Map<string, ChainInfo | null>();

  for (const { chain, aliases } of chains) {
    for (const name of [chain.chainName, ...aliases]) {
      const normalized = normalizeBusinessName(name);
      if (!normalized) continue;

      const existing = index.get(normalized);
      if (existing === undefined) {
        index.set(normalized, chain);
      } else if (existing !== null && existing.wikidataId !== chain.wikidataId) {
        index.set(normalized, null); // ambiguous — two different chains share this name
      }
    }
  }

  return index;
}

interface EstablishmentRow {
  fhrsId: number;
  businessName: string;
}

function matchRowTuple(fhrsId: number, chain: ChainInfo, retrievedAt: Date) {
  return Prisma.sql`(${fhrsId}, ${chain.wikidataId}, ${chain.chainName}, ${chain.foundedDate}, ${chain.headquarters}, ${chain.website}, ${SOURCE}, ${LICENCE}, ${retrievedAt}, now())`;
}

async function persistMatches(matches: Map<number, ChainInfo>, retrievedAt: Date): Promise<void> {
  const entries = [...matches.entries()];
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await prisma.$executeRaw`
      INSERT INTO "ChainMatch" (
        "fhrsId", "wikidataId", "chainName", "foundedDate", "headquarters", "website",
        "source", "licence", "retrievedAt", "matchedAt"
      )
      VALUES ${Prisma.join(batch.map(([fhrsId, chain]) => matchRowTuple(fhrsId, chain, retrievedAt)))}
      ON CONFLICT ("fhrsId") DO UPDATE SET
        "wikidataId" = EXCLUDED."wikidataId",
        "chainName" = EXCLUDED."chainName",
        "foundedDate" = EXCLUDED."foundedDate",
        "headquarters" = EXCLUDED."headquarters",
        "website" = EXCLUDED."website",
        "source" = EXCLUDED."source",
        "licence" = EXCLUDED."licence",
        "retrievedAt" = EXCLUDED."retrievedAt",
        "matchedAt" = EXCLUDED."matchedAt"
    `;
  }
}

async function main() {
  const retrievedAt = new Date();

  console.log("Fetching UK chains from Wikidata...");
  const chains = await fetchUkChains();
  console.log(`Fetched ${chains.length} UK chains.`);

  const index = buildChainIndex(chains);
  const ambiguous = [...index.values()].filter((v) => v === null).length;
  console.log(`Built name index: ${index.size} distinct names/aliases (${ambiguous} ambiguous, excluded).`);

  console.log("Loading active FSA establishments...");
  const establishments = await prisma.$queryRaw<EstablishmentRow[]>`
    SELECT "fhrsId", "businessName" FROM "Establishment" WHERE "isActive" = true
  `;
  console.log(`Matching ${establishments.length.toLocaleString()} establishments...`);

  const matches = new Map<number, ChainInfo>();
  let processed = 0;
  for (const establishment of establishments) {
    const normalized = normalizeBusinessName(establishment.businessName);
    const chain = index.get(normalized);
    if (chain) matches.set(establishment.fhrsId, chain);

    processed++;
    if (processed % MATCH_PROGRESS_INTERVAL === 0) {
      console.log(`  ...${processed.toLocaleString()} of ${establishments.length.toLocaleString()} matched against (${matches.size.toLocaleString()} found so far)`);
    }
  }

  console.log(`Writing ${matches.size.toLocaleString()} match results...`);
  await persistMatches(matches, retrievedAt);

  console.log("\nMatch complete");
  console.log(`  Establishments checked: ${establishments.length.toLocaleString()}`);
  console.log(`  Chains matched:         ${matches.size.toLocaleString()} (${((matches.size / establishments.length) * 100).toFixed(2)}%)`);
}

main()
  .catch((err) => {
    console.error("Wikidata match failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
