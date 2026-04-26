#!/usr/bin/env node
// Enrich empty artist bios in src/data/artists.ts via Claude API.
//
// Usage:
//   node scripts/enrich_bios.mjs                    # process all empty bios
//   node scripts/enrich_bios.mjs --limit 10         # process first 10 only
//   node scripts/enrich_bios.mjs --dry-run          # print, don't write
//   node scripts/enrich_bios.mjs --only "Irma Thomas,Jon Batiste"   # specific names
//   node scripts/enrich_bios.mjs --count            # just print how many would be processed
//   node scripts/enrich_bios.mjs --rpm 4            # throttle to 4 req/min (free tier safe)
//   node scripts/enrich_bios.mjs --concurrency 5    # parallel workers (default 3)
//
// Requires ANTHROPIC_API_KEY in .env.local or shell env (not for --count).
// Retries on 429 / 5xx with exponential backoff up to 5 attempts.
// Writes results back in place. Only touches rows where bio is "".

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const ARTISTS_FILE = join(REPO_ROOT, "src/data/artists.ts");
const ENV_FILE = join(REPO_ROOT, ".env.local");

const MODEL = "claude-sonnet-4-6";
const DEFAULT_CONCURRENCY = 3;
const CHECKPOINT_EVERY = 10;
const MAX_RETRIES = 5;

// ----- args -----
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const LIMIT = value("--limit") ? parseInt(value("--limit"), 10) : Infinity;
const DRY_RUN = flag("--dry-run");
const COUNT_ONLY = flag("--count");
const ONLY = value("--only")?.split(",").map((s) => s.trim().toLowerCase()) ?? null;
const CONCURRENCY = value("--concurrency") ? parseInt(value("--concurrency"), 10) : DEFAULT_CONCURRENCY;
const RPM = value("--rpm") ? parseInt(value("--rpm"), 10) : 0; // 0 = no throttle

// ----- env -----
function loadApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  if (existsSync(ENV_FILE)) {
    const env = readFileSync(ENV_FILE, "utf8");
    const match = env.match(/^ANTHROPIC_API_KEY\s*=\s*(.+?)\s*$/m);
    if (match) return match[1].replace(/^["']|["']$/g, "");
  }
  console.error("Missing ANTHROPIC_API_KEY. Add it to .env.local or export it.");
  process.exit(1);
}
const API_KEY = COUNT_ONLY ? null : loadApiKey();

// ----- prompt -----
const SYSTEM_PROMPT = `You write concise factual bios for musicians playing at the New Orleans Jazz & Heritage Festival.

FORMAT (match exactly):
"<Hometown or origin>. <What they're known for>; <signature sound, key works, or notable career detail>."

EXAMPLES (this is the gold-standard style — match length, tone, and shape):

Irma Thomas → "New Orleans, Louisiana. The Soul Queen of New Orleans; six-decade career anchored by 1960s hits 'It's Raining' and 'Time Is on My Side' (later covered by the Rolling Stones). Won the 2007 Grammy for Best Contemporary Blues Album and a 2019 Lifetime Achievement Grammy."

Vieux Farka Touré → "Niafunké, Mali. Guitarist and singer known as the 'Hendrix of the Sahara'; son of legendary blues musician Ali Farka Touré. Blends desert blues with rock and traditional Songhai music; collaborations include Dave Matthews and Khruangbin."

Jon Batiste → "Kenner, Louisiana. Pianist, bandleader, and former 'Late Show with Stephen Colbert' music director; from the Batiste musical dynasty. Won the 2022 Album of the Year Grammy for 'WE ARE' and an Oscar for the 'Soul' soundtrack."

RULES:
- 1-3 sentences. Aim for 25-60 words.
- Lead with hometown or geographic origin (city + state/country). If a band, use where they're based.
- Plain text only. No markdown, no bullets, no quotes wrapping the whole thing.
- Use semicolons or periods to separate clauses, matching the examples.
- ONLY include facts you are confident are correct. Do NOT invent songs, albums, awards, dates, or hometowns.
- If you do not know this artist with high confidence, return an empty bio. Better blank than wrong.

GENRE: A single short label (e.g. "Soul", "Funk", "Bluegrass", "Zydeco", "Jazz", "R&B", "Reggae", "Brass Band", "Gospel", "Hip-Hop", "Rock", "Country", "Latin", "Cajun", "Blues"). Return empty string if uncertain.

OUTPUT: Strict JSON only. No prose, no markdown fence.
{"bio": "...", "genre": "..."}`;

// Simple shared throttle: at most one request every (60 / RPM) seconds.
let nextSlot = 0;
async function throttle() {
  if (!RPM) return;
  const intervalMs = 60_000 / RPM;
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + intervalMs;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callClaudeOnce(artistName, stage) {
  await throttle();
  const userMessage = `Artist: ${artistName}\nStage at Jazz Fest 2026: ${stage}\n\nReturn JSON only.`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  return res;
}

async function callClaude(artistName, stage) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let res;
    try {
      res = await callClaudeOnce(artistName, stage);
    } catch (e) {
      lastErr = e;
      await sleep(2 ** attempt * 1000);
      continue;
    }
    if (res.ok) {
      const data = await res.json();
      return parseResponse(data);
    }
    // Retry on 429 + 5xx. Honor `retry-after` (seconds) or `retry-after-ms`.
    if (res.status === 429 || res.status >= 500) {
      const retryAfterMs = parseInt(res.headers.get("retry-after-ms") ?? "0", 10);
      const retryAfterS = parseInt(res.headers.get("retry-after") ?? "0", 10);
      const baseWait = retryAfterMs || retryAfterS * 1000 || 2 ** attempt * 1000;
      const jitter = Math.floor(Math.random() * 500);
      await sleep(baseWait + jitter);
      lastErr = new Error(`API ${res.status} (retried)`);
      continue;
    }
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }
  throw lastErr ?? new Error("Max retries exceeded");
}

function parseResponse(data) {
  const text = data.content?.[0]?.text ?? "";
  try {
    const parsed = JSON.parse(text.trim());
    return {
      bio: typeof parsed.bio === "string" ? parsed.bio : "",
      genre: typeof parsed.genre === "string" ? parsed.genre : "",
      cacheRead: data.usage?.cache_read_input_tokens ?? 0,
      cacheWrite: data.usage?.cache_creation_input_tokens ?? 0,
    };
  } catch {
    console.warn(`  ! Non-JSON response: ${text.slice(0, 80)}`);
    return { bio: "", genre: "", cacheRead: 0, cacheWrite: 0 };
  }
}

// ----- artists.ts parsing -----
// Match each artist literal block. The file has a strict, repeating shape.
// String body uses (?:[^"\\]|\\.)* to allow escaped quotes — e.g. `Jonathon \"Boogie\" Long`.
const STR = `"((?:[^"\\\\]|\\\\.)*)"`;
const ARTIST_BLOCK_RE = new RegExp(
  `\\{\\s*artist_name:\\s*${STR},\\s*stage:\\s*${STR},\\s*day:\\s*${STR},\\s*start_time:\\s*${STR},\\s*end_time:\\s*${STR},\\s*bio:\\s*${STR},\\s*genre:\\s*${STR},\\s*\\},?`,
  "g"
);

function findEmptyBioArtists(fileText) {
  const out = [];
  for (const m of fileText.matchAll(ARTIST_BLOCK_RE)) {
    const [block, name, stage, day, startTime, endTime, bio, genre] = m;
    if (bio === "") {
      out.push({ block, name, stage, day, startTime, endTime, bio, genre, index: m.index });
    }
  }
  return out;
}

// Replace bio + genre in a specific block. We anchor on the unique full-block
// match so we don't accidentally edit a different artist's row.
function replaceArtistBlock(fileText, oldBlock, newBio, newGenre) {
  // Reconstruct the new block by string-replacing only the bio: "" and genre: "" inside the block.
  let newBlock = oldBlock.replace(/bio:\s*""/, `bio: ${JSON.stringify(newBio)}`);
  if (newGenre) {
    newBlock = newBlock.replace(/genre:\s*""/, `genre: ${JSON.stringify(newGenre)}`);
  }
  return fileText.replace(oldBlock, newBlock);
}

// ----- runner -----
function shouldProcess(artist) {
  if (ONLY) return ONLY.some((q) => artist.name.toLowerCase().includes(q));
  return true;
}

async function pool(items, worker, n) {
  const results = [];
  let i = 0;
  async function next() {
    while (i < items.length) {
      const myI = i++;
      results[myI] = await worker(items[myI], myI);
    }
  }
  await Promise.all(Array.from({ length: n }, next));
  return results;
}

async function main() {
  let fileText = readFileSync(ARTISTS_FILE, "utf8");
  const candidates = findEmptyBioArtists(fileText).filter(shouldProcess);
  const targets = candidates.slice(0, LIMIT);

  console.log(`Found ${candidates.length} empty-bio artist(s) matching filter.`);
  if (COUNT_ONLY) {
    console.log("First 5:");
    for (const a of candidates.slice(0, 5)) console.log(`  - ${a.name} (${a.stage}, ${a.day})`);
    return;
  }
  console.log(`Processing ${targets.length} (limit=${LIMIT === Infinity ? "all" : LIMIT}, dry-run=${DRY_RUN}).`);
  if (targets.length === 0) return;

  let done = 0, filled = 0, skipped = 0, cacheHits = 0;

  await pool(
    targets,
    async (a) => {
      try {
        const result = await callClaude(a.name, a.stage);
        done++;
        cacheHits += result.cacheRead;
        if (result.bio) {
          filled++;
          console.log(`[${done}/${targets.length}] ✓ ${a.name}`);
          console.log(`    ${result.bio}`);
          if (!DRY_RUN) {
            fileText = replaceArtistBlock(fileText, a.block, result.bio, result.genre);
            // Checkpoint
            if (filled % CHECKPOINT_EVERY === 0) {
              writeFileSync(ARTISTS_FILE, fileText);
              console.log(`    --- checkpoint saved (${filled} filled) ---`);
            }
          }
        } else {
          skipped++;
          console.log(`[${done}/${targets.length}] · ${a.name} (no confident bio — left blank)`);
        }
      } catch (err) {
        done++;
        skipped++;
        console.error(`[${done}/${targets.length}] ✗ ${a.name} — ${err.message}`);
      }
    },
    CONCURRENCY
  );

  if (!DRY_RUN && filled > 0) {
    writeFileSync(ARTISTS_FILE, fileText);
  }

  console.log("");
  console.log(`Done. Filled: ${filled}, blanked: ${skipped}, total: ${done}.`);
  console.log(`Prompt-cache reads: ${cacheHits.toLocaleString()} tokens.`);
  if (DRY_RUN) console.log("(dry run — no file written)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
