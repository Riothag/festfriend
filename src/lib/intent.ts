import { artists as scheduleArtists } from "@/data/artists";
import { foodHeritageDemos } from "@/data/food_heritage";
import { stages } from "@/data/stages";
import { vendors } from "@/data/vendors";
import { festivalDays, festivalTimezone } from "@/data/festival";
import { demos } from "@/data/cultural_programs";
import { faqs } from "@/data/faqs";
import { recommendations, type Recommendation } from "@/data/recommendations";

// Music schedule + cooking demos merged. Both conform to the Artist shape.
const artists = [...scheduleArtists, ...foodHeritageDemos];
import { formatTime, getFestivalNow, toMinutes } from "@/lib/time";
import type { AnswerContext, AnswerResult, Artist, Demo, FAQ, FestivalDay, Intent, PendingDisambiguation, Stage, Vendor } from "@/types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// Voice-to-text and autocorrect cleanup. Applied before any other processing
// so downstream rules see the corrected query. Intentionally conservative —
// only fixes patterns we've actually seen in real query logs.
function correctVoiceTypos(query: string): string {
  let s = query;
  // "tente" / "tents" → "tent" (autocorrect on "tent" producing French diacritic forms)
  s = s.replace(/\btente\b/gi, "tent");
  s = s.replace(/\btents\b/gi, "tent");
  // "X 10" where X is a stage prefix → "X tent" (voice mishears "tent" as "10")
  s = s.replace(/\b(gospel|jazz|blues|economy|economy hall|kids|wwoz)\s+10\b/gi, "$1 tent");
  // Apostrophe-y "playint" / "playin" → "playing"
  s = s.replace(/\bplayint\b/gi, "playing");
  s = s.replace(/\bplayin\b/gi, "playing");
  // Po-boy variants → "po boy" (canonical for our food-item tokens). Catches
  // "poboy", "poboys", "po-boy", "po-boys", "poor boy", "poor boys" — all
  // common phrasings of the same sandwich.
  s = s.replace(/\bpoboys\b/gi, "po boys");
  s = s.replace(/\bpoboy\b/gi, "po boy");
  s = s.replace(/\bpo-boys\b/gi, "po boys");
  s = s.replace(/\bpo-boy\b/gi, "po boy");
  s = s.replace(/\bpoor\s+boys\b/gi, "po boys");
  s = s.replace(/\bpoor\s+boy\b/gi, "po boy");
  return s;
}

// Singularize a token. Threshold is length ≥ 4 so "pies" → "pie" and
// "wings" → "wing" both work, while "Nas" (3) is preserved. Handles the
// common -ies → -ie pattern explicitly. Only used in food matching, so
// false positives (e.g. "fries" → "frie") don't affect artist resolution.
function singularize(t: string): string {
  if (t.length >= 5 && t.endsWith("ies")) return t.slice(0, -3) + "ie";
  if (t.length >= 4 && t.endsWith("s") && !t.endsWith("ss") && !t.endsWith("us")) {
    return t.slice(0, -1);
  }
  return t;
}

// Common words we never want to match on for fuzzy artist/genre matching.
const STOPWORDS = new Set([
  "the", "and", "for", "who", "what", "when", "where", "why", "how",
  "is", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "have", "has", "had",
  "can", "could", "should", "would", "will",
  "playing", "play", "plays", "played",
  "time", "stage", "day", "today", "tonight",
  "set", "sets",
  "first", "second", "next", "last",
  "this", "that", "these", "those",
  "about", "tell", "give", "show", "find",
  "new", "orleans", "nola",
  "jazz", "fest", "festival",
  "any", "some", "all",
  "with", "from", "into", "over", "under",
]);

function tokens(s: string): string[] {
  return norm(s).split(" ").filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

// Iterative Levenshtein with O(n) memory. Used to forgive small typos in
// artist names ("rod stewert" → "Rod Stewart").
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  const curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr.slice();
  }
  return prev[n];
}

// Two tokens are a fuzzy match if they're equal or within a length-scaled
// edit-distance budget. Tight rules so unrelated common words don't collide
// — e.g. "main" must NOT fuzzy-match "pain".
function fuzzyTokenMatch(qt: string, at: string): boolean {
  if (qt === at) return true;
  // Allow short fuzzy matches (e.g. "naz" → "nas") with strict budget.
  if (qt.length < 3 || at.length < 3) return false;
  // Require the first character to agree. Most typos preserve the leading
  // letter, and this rejects coincidental overlaps like "main" / "pain".
  if (qt[0] !== at[0]) return false;
  if (Math.abs(qt.length - at.length) > 2) return false;
  const longer = Math.max(qt.length, at.length);
  // Length-scaled budget: 1 for ≤6 chars, 2 for 7+, 3 for 9+.
  // Keeps "naz" → "nas" (1 edit) while letting "frida" → "freedia" (3 edits)
  // resolve at the longer length.
  const budget = longer >= 9 ? 3 : longer >= 7 ? 2 : 1;
  return editDistance(qt, at) <= budget;
}

// ---- Lookups ----

// Words that look like they could match an artist name via substring but are
// really day/time indicators or generic terms. Bare queries of these words
// should NOT resolve to an artist (e.g. "friday" shouldn't match "Kevin
// Louis & The Friday Night Jazz Band"; "now" shouldn't match "Knowles").
// They still match when embedded in a longer query that legitimately
// contains an artist name.
const BARE_NON_ARTIST_WORDS = new Set([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "mon", "tues", "wed", "thu", "thur", "thurs", "fri", "sat", "sun",
  "today", "tomorrow", "tonight", "yesterday",
  "apr", "april", "may",
  "first", "second", "last",
  "morning", "afternoon", "evening", "night",
  "weekend",
  // Generic words that substring-collide with artist names.
  "now", "all", "any", "some", "show", "list", "everyone", "anything",
  "thing", "things", "time", "stuff", "next", "before", "after",
]);

function scoreArtists(query: string): { artist: Artist; score: number }[] {
  const q = norm(query);
  if (!q) return [];
  // Reject bare day/time/generic words up front — they substring-match too
  // loosely (e.g. "now" inside "Knowles", "all" inside "Allstars").
  if (BARE_NON_ARTIST_WORDS.has(q)) return [];
  // Exact
  const exact = artists.filter((a) => norm(a.artist_name) === q).map((a) => ({ artist: a, score: 100 }));
  if (exact.length > 0) return exact;
  // Substring (full query inside name, or short name inside query).
  // For short queries (< 4 chars), require word-boundary match to avoid
  // accidental hits like "now" → "Knowles".
  const substring = artists
    .filter((a) => {
      const name = norm(a.artist_name);
      if (q.length >= 4) {
        return name.includes(q) || q.includes(name);
      }
      // Short query: word-boundary inside the name only.
      return new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(name);
    })
    .map((a) => ({ artist: a, score: 50 }));
  if (substring.length > 0) return substring;
  // Token overlap with stopwords filtered. Falls back to fuzzy matching
  // (small edit distance) so light typos like "rod stewert" still match.
  const qTokens = tokens(q);
  if (qTokens.length === 0) return [];
  const scored: { artist: Artist; score: number }[] = [];
  for (const a of artists) {
    const aTokens = tokens(a.artist_name);
    if (aTokens.length === 0) continue;
    const overlap = qTokens.filter((t) => aTokens.includes(t)).length;
    if (overlap >= 2 || (overlap === 1 && aTokens.length === 1)) {
      scored.push({ artist: a, score: overlap * 2 });
      continue;
    }
    // Fuzzy fallback. Two ways to qualify:
    //   (1) All artist tokens fuzzy-match a query token (high confidence).
    //   (2) For multi-token artist names, a query that's just one
    //       distinctive token may match the LONGEST artist token alone —
    //       this lets "Fredia" → "Big Freedia" without making short queries
    //       hit too liberally. Requires the matched token to be ≥5 chars
    //       (so "Big" or "The" wouldn't qualify on their own).
    const matchedArtistTokens = aTokens.filter((at) =>
      qTokens.some((qt) => fuzzyTokenMatch(qt, at)),
    ).length;
    if (matchedArtistTokens === aTokens.length) {
      if (aTokens.length >= 2) {
        scored.push({ artist: a, score: matchedArtistTokens });
      } else if (qTokens.length <= 2) {
        scored.push({ artist: a, score: 1 });
      }
    } else if (
      qTokens.length === 1 &&
      aTokens.length >= 2 &&
      matchedArtistTokens >= 1
    ) {
      // Single-token query, multi-token artist: accept if the matched
      // artist token is meaningful in length (not "Big", "The", etc.).
      const matchedTokens = aTokens.filter((at) =>
        qTokens.some((qt) => fuzzyTokenMatch(qt, at)),
      );
      const meaningful = matchedTokens.find((t) => t.length >= 5);
      if (meaningful) scored.push({ artist: a, score: 1 });
    }
  }
  return scored.sort((a, b) => b.score - a.score);
}

function findArtist(query: string): Artist | null {
  const matches = scoreArtists(query);
  return matches[0]?.artist ?? null;
}

// All matches for disambiguation
function findArtists(query: string): Artist[] {
  return scoreArtists(query).map((m) => m.artist);
}

// Common short / colloquial names that should resolve to a specific stage.
// Checked as WORD-BOUNDARY matches against the query, so "jazz" alone (a genre
// token) doesn't hijack — the aliases here require the distinctive word to
// appear as its own phrase.
const STAGE_ALIASES: { alias: string; stage: string }[] = [
  { alias: "main stage", stage: "Festival Stage" },
  { alias: "headliner stage", stage: "Festival Stage" },
  { alias: "gentilly stage", stage: "Shell Gentilly Stage" },
  { alias: "gentilly", stage: "Shell Gentilly Stage" },
  { alias: "fais do do stage", stage: "Sheraton New Orleans Fais Do-Do Stage" },
  { alias: "fais do-do stage", stage: "Sheraton New Orleans Fais Do-Do Stage" },
  { alias: "fais do do", stage: "Sheraton New Orleans Fais Do-Do Stage" },
  { alias: "fais do-do", stage: "Sheraton New Orleans Fais Do-Do Stage" },
  { alias: "fais-do-do", stage: "Sheraton New Orleans Fais Do-Do Stage" },
  { alias: "jazz & heritage stage", stage: "Jazz & Heritage Stage" },
  { alias: "jazz and heritage stage", stage: "Jazz & Heritage Stage" },
  { alias: "heritage stage", stage: "Jazz & Heritage Stage" },
  { alias: "jazz heritage", stage: "Jazz & Heritage Stage" },
  { alias: "wwoz jazz tent", stage: "WWOZ Jazz Tent" },
  { alias: "jazz tent", stage: "WWOZ Jazz Tent" },
  { alias: "wwoz", stage: "WWOZ Jazz Tent" },
  { alias: "allison miner", stage: "Allison Miner Music Heritage Stage" },
  { alias: "allison miner stage", stage: "Allison Miner Music Heritage Stage" },
  { alias: "music heritage stage", stage: "Allison Miner Music Heritage Stage" },
  { alias: "cultural exchange pavilion", stage: "Sandals Resorts Jamaica Cultural Exchange Pavilion" },
  { alias: "cultural exchange", stage: "Sandals Resorts Jamaica Cultural Exchange Pavilion" },
  { alias: "jamaica pavilion", stage: "Sandals Resorts Jamaica Cultural Exchange Pavilion" },
  { alias: "pavilion", stage: "Sandals Resorts Jamaica Cultural Exchange Pavilion" },
  { alias: "ochsner childrens tent", stage: "Ochsner Children's Tent" },
  { alias: "ochsner children s tent", stage: "Ochsner Children's Tent" },
  { alias: "children s tent", stage: "Ochsner Children's Tent" },
  { alias: "kids tent", stage: "Ochsner Children's Tent" },
  { alias: "rhythmpourium", stage: "Rhythmpourium Tent" },
  { alias: "rhythmpourium tent", stage: "Rhythmpourium Tent" },
];

function findStage(query: string): Stage | null {
  const q = norm(query);
  if (!q) return null;
  // (1) Exact match
  let hit = stages.find((s) => norm(s.stage_name) === q);
  if (hit) return hit;
  // (2) Substring either direction + short-name substring
  hit = stages.find((s) => {
    const sn = norm(s.stage_name);
    const snShort = sn.replace(" stage", "").replace(" tent", "");
    return sn.includes(q) || q.includes(sn) || (snShort && q.includes(snShort));
  });
  if (hit) return hit;
  // (3) Alias table — tries longer aliases first so "gentilly stage" wins
  //     over bare "gentilly" when both could apply.
  const sortedAliases = [...STAGE_ALIASES].sort((a, b) => b.alias.length - a.alias.length);
  for (const { alias, stage } of sortedAliases) {
    const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (re.test(q)) {
      const found = stages.find((s) => s.stage_name === stage);
      if (found) return found;
    }
  }
  // (4) Token-overlap fallback. "economy tent" → Economy Hall Tent because
  //     {economy, tent} is a subset of {economy, hall, tent}. Requires the
  //     query to bring at least one DISTINCTIVE (not "stage" / "tent") token
  //     so generic words alone don't match a random stage.
  const qWords = q.split(" ").filter((w) => w.length >= 3);
  if (qWords.length >= 1) {
    const candidates = stages
      .map((s) => {
        const sn = norm(s.stage_name);
        const sWords = sn.split(" ").filter((w) => w.length >= 3);
        const matches = qWords.filter((w) => sWords.includes(w));
        const distinctive = matches.filter((w) => w !== "stage" && w !== "tent" && w !== "hall");
        return { stage: s, matchCount: matches.length, distinctive: distinctive.length, sWordCount: sWords.length };
      })
      .filter((c) => c.distinctive >= 1 && c.matchCount >= Math.min(2, c.sWordCount))
      .sort((a, b) => b.matchCount - a.matchCount);
    if (candidates.length > 0) return candidates[0].stage;
  }
  return null;
}

// Standard "which day?" prompt, used whenever findDays returns multiple
// options and the caller needs the user to pin it down.
function whichDayPrompt(days: FestivalDay[], originalQuery: string): { response: string; pending: PendingDisambiguation } {
  return {
    response: [
      `Which day?`,
      ...days.map((d) => `• ${d}`),
      ``,
      `Reply with "23" / "30", "first" / "second", or the full date.`,
    ].join("\n"),
    pending: { kind: "day", options: days, originalQuery },
  };
}

// Resolve "today" / "tonight" / "tomorrow" / "yesterday" to a festival day,
// or null if the resulting calendar date isn't a festival day.
function resolveRelativeDay(q: string): FestivalDay | null {
  let offset: number | null = null;
  if (/\b(today|tonight)\b/.test(q)) offset = 0;
  else if (/\btomorrow\b/.test(q)) offset = 1;
  else if (/\byesterday\b/.test(q)) offset = -1;
  if (offset === null) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: festivalTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const todayUtc = new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00Z`);
  const targetStr = new Date(todayUtc.getTime() + offset * 86400000).toISOString().slice(0, 10);
  return festivalDays.find((d) => d.date === targetStr)?.day ?? null;
}

// Resolve a query to one or more festival days. Empty array if no day reference.
function findDays(query: string): FestivalDay[] {
  const q = norm(query);
  const matches: FestivalDay[] = [];
  for (const d of festivalDays) {
    if (q.includes(norm(d.day))) matches.push(d.day);
  }
  if (matches.length > 0) return Array.from(new Set(matches));

  const relative = resolveRelativeDay(q);
  if (relative) return [relative];

  const has = (w: string) => new RegExp(`\\b${w}\\b`).test(q);
  const byWeekday = (weekday: "fri" | "sat" | "sun" | "thu"): FestivalDay[] =>
    festivalDays.filter((d) => d.day.toLowerCase().startsWith(weekday)).map((d) => d.day);

  let weekday: "fri" | "sat" | "sun" | "thu" | null = null;
  if (has("thursday") || has("thurs") || has("thu")) weekday = "thu";
  else if (has("friday") || has("fri")) weekday = "fri";
  else if (has("saturday") || has("sat")) weekday = "sat";
  else if (has("sunday") || has("sun")) weekday = "sun";
  if (!weekday) return [];

  const days = byWeekday(weekday);
  if (days.length <= 1) return days;
  // Only auto-pick a weekend when the user is explicit. Bare weekdays,
  // relative-time words ("this/next/coming"), and ambiguous words like
  // "last", "opening", "closing" return both options so the caller can ask.
  // Explicit selectors:
  //   - "first sunday" / "second friday" / "1st" / "2nd"
  //   - "weekend 1" / "weekend 2"
  //   - "opening weekend" / "closing weekend" (or paired with a weekday)
  //   - month references ("april" / "may")
  const firstSelector = /\b(first|1st)\s+(weekend|thursday|thu|friday|fri|saturday|sat|sunday|sun)\b/.test(q);
  const secondSelector = /\b(second|2nd)\s+(weekend|thursday|thu|friday|fri|saturday|sat|sunday|sun)\b/.test(q);
  const openingWeekend = /\bopening\s+(weekend|thursday|thu|friday|fri|saturday|sat|sunday|sun)\b/.test(q);
  const closingWeekend = /\bclosing\s+(weekend|thursday|thu|friday|fri|saturday|sat|sunday|sun)\b/.test(q);
  if (firstSelector || has("weekend 1") || has("apr") || has("april") || openingWeekend) {
    return [days[0]];
  }
  if (secondSelector || has("weekend 2") || has("may") || closingWeekend) {
    return [days[days.length - 1]];
  }
  return days;
}

// Single-word food tokens that are too generic to confidently match by
// themselves. If a query contains "bread", that's not enough to pin a vendor.
const GENERIC_FOOD_TOKENS = new Set([
  "bread", "sandwiches", "sandwich", "pasta", "food", "drinks", "drink",
  "wraps", "salads", "salad", "sides", "meat", "ice", "cocktails",
  "options", "classics", "plates", "plate", "cuisine", "specialties",
  "sauce",
]);

function findVendorsByFood(query: string): Vendor[] {
  const q = norm(query);
  if (!q) return [];
  const hasWord = (needle: string) => needle && new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(q);

  // Singularize for plural-aware overlap. Keep the raw tokens too so
  // word-boundary checks against original strings still work.
  const qTokens = tokens(q);
  const qTokensSingular = qTokens.map(singularize);

  type Scored = { vendor: Vendor; score: number };
  const scored: Scored[] = [];

  for (const v of vendors) {
    let score = 0;
    const vn = norm(v.vendor_name);

    // Vendor name match (word-boundary) — most specific.
    if (hasWord(vn)) score = Math.max(score, 100);

    // Food items — score by specificity.
    for (const f of v.food_items) {
      const nf = norm(f);
      if (!nf) continue;
      const words = nf.split(" ");
      if (words.length >= 2) {
        // Full multi-word food item in query → strongest.
        if (hasWord(nf)) score = Math.max(score, 90);
        // Multi-word PREFIX of the food item in the query.
        // e.g. "cochon de lait" → matches "Cochon de Lait Po-Boy".
        // Require the prefix to have ≥2 non-generic words to prevent
        // "bread" (prefix of "bread pudding") from matching weakly.
        for (let i = words.length - 1; i >= 2; i--) {
          const prefix = words.slice(0, i).join(" ");
          if (hasWord(prefix)) {
            const nonGeneric = prefix.split(" ").filter((w) => !GENERIC_FOOD_TOKENS.has(w));
            if (nonGeneric.length >= 2) {
              score = Math.max(score, 85);
              break;
            }
          }
        }
        // Token overlap with the food item's meaningful words.
        // e.g. "pheasant gumbo" shares {pheasant, gumbo} with
        // "Pheasant Quail and Andouille Gumbo" → stronger than plain "gumbo".
        // Compare singular forms so "meat pies" matches "Meat Pie".
        const foodTokens = words.filter((t) => t.length > 2 && !GENERIC_FOOD_TOKENS.has(t));
        const foodTokensSingular = foodTokens.map(singularize);
        const overlap = qTokensSingular.filter((t) => foodTokensSingular.includes(t)).length;
        if (overlap >= 2) {
          score = Math.max(score, 85);
        } else if (overlap === 1 && qTokens.length <= 2 && foodTokens.length >= 1) {
          // Narrow query ("oysters", "gyro", "pie") matching the head noun of
          // a multi-word food item ("Charbroiled Oysters", "Gyro Sandwich",
          // "Apple Pie"). Mild but real signal — multiple vendors can tie here
          // and the user gets a list.
          score = Math.max(score, 65);
        } else if (
          overlap === 0 &&
          qTokens.length <= 2 &&
          foodTokens.length >= 1
        ) {
          // Last-chance: "meat pies" → "Meat Pie" — strict overlap fails
          // because "meat" is in GENERIC_FOOD_TOKENS. Try matching against
          // the FULL words list (incl. generics) once we've singularized.
          const allWordsSingular = words.map(singularize);
          const looseOverlap = qTokensSingular.filter((t) =>
            allWordsSingular.includes(t),
          ).length;
          if (looseOverlap >= 2) score = Math.max(score, 70);
        }
      } else {
        // Single-word food item — only counts if it's non-generic.
        // Singular-form word-boundary check so "pies" → "pie".
        const nfSingular = singularize(nf);
        if (!GENERIC_FOOD_TOKENS.has(nf) && (hasWord(nf) || hasWord(nfSingular))) {
          score = Math.max(score, 70);
        }
      }
    }

    // Category — weak signal, only used if nothing stronger fires.
    if (hasWord(norm(v.category))) score = Math.max(score, 30);

    if (score > 0) scored.push({ vendor: v, score });
  }

  if (scored.length === 0) return [];
  const topScore = Math.max(...scored.map((s) => s.score));
  // Reject weak-only hits ("bread" alone in a query with no stronger match).
  if (topScore < 60) return [];
  return scored.filter((s) => s.score === topScore).map((s) => s.vendor);
}

// ---- Genre detection (built from data) ----

const KNOWN_GENRE_TOKENS: Set<string> = (() => {
  const set = new Set<string>();
  for (const a of artists) {
    norm(a.genre).split(" ").forEach((t) => {
      if (t.length > 1) set.add(t);
    });
  }
  // Aliases people actually type
  ["funky", "bluesy", "jazzy", "soulful", "rb", "rnb", "hiphop", "rap", "country", "edm", "house", "indie"].forEach((t) => set.add(t));
  return set;
})();

const GENRE_ALIAS: Record<string, string[]> = {
  // Map a typed token to one or more canonical tokens to match against genre fields.
  funky: ["funk"],
  bluesy: ["blues"],
  jazzy: ["jazz"],
  soulful: ["soul"],
  rb: ["rb", "rnb"],
  rnb: ["rb", "rnb"],
  hiphop: ["hip", "hop", "hiphop"],
};

function findGenres(query: string): string[] {
  const q = norm(query);
  const found = new Set<string>();
  for (const t of q.split(" ")) {
    if (KNOWN_GENRE_TOKENS.has(t)) {
      const expanded = GENRE_ALIAS[t] ?? [t];
      expanded.forEach((x) => found.add(x));
    }
  }
  return [...found];
}

function matchesAnyGenre(artist: Artist, genreTokens: string[]): boolean {
  const aTokens = norm(artist.genre).split(" ");
  return genreTokens.some((g) => aTokens.includes(g));
}

// ---- Time parsing ----

// IMPORTANT: this does NOT use norm() — norm() strips colons, which would
// break "3:00" / "5:30pm" matching. We lowercase only.
function parseClockTime(query: string): number | null {
  const q = query.toLowerCase();

  // (0) "noon" / "midday" → 12:00 PM. (Midnight isn't a festival hour.)
  if (/\b(noon|midday)\b/.test(q)) return 12 * 60;

  // (1) "5pm", "5 pm", "5:30pm", "5:30 pm" — explicit am/pm.
  const reAmPm = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/;
  const m = q.match(reAmPm);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const period = m[3];
    if (period === "pm" && h < 12) h += 12;
    if (period === "am" && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }

  // (2) "3:00" / "17:00" — bare H:MM (colon required so "23" alone doesn't hit).
  const re24 = /\b(\d{1,2}):(\d{2})\b/;
  const m24 = q.match(re24);
  if (m24) {
    let h = parseInt(m24[1], 10);
    const min = parseInt(m24[2], 10);
    if (h > 23 || min > 59) return null;
    // Festival runs afternoon/evening. If hour is 1-11, assume PM.
    if (h >= 1 && h <= 11) h += 12;
    return h * 60 + min;
  }

  // (3) "at 3", "at 5 o'clock", "at 11" — bare hour after "at" / "around".
  // Same PM heuristic; festival is afternoon/evening.
  const reAtHour = /\b(?:at|around|by)\s+(\d{1,2})(?:\s*o['’]?clock)?\b/;
  const mAt = q.match(reAtHour);
  if (mAt) {
    let h = parseInt(mAt[1], 10);
    if (h > 23) return null;
    if (h >= 1 && h <= 11) h += 12;
    return h * 60;
  }

  return null;
}

function hasClockTime(query: string): boolean {
  return parseClockTime(query) !== null;
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return formatTime(`${h}:${String(m).padStart(2, "0")}`);
}

// ---- Phrase tables ----

const NOW_PHRASES = [
  "who is playing now", "whos playing now", "who's playing now",
  "playing now", "playing right now", "right now",
  "on now", "on stage now", "current set", "currently playing",
];

const BIO_PHRASES = ["tell me about", "who is ", "whos ", "who's ", "bio of", "about the band", "about "];
const STAGE_PHRASES = ["on the", "at the", "on stage", "stage schedule", "schedule for", "playing on"];
const TIME_PHRASES = ["what time", "when does", "when is", "when do", "time does", "time is"];
const FOOD_PHRASES = [
  "where is", "where can i find", "find food", "food", "eat", "vendor",
  "crawfish", "po boy", "po-boy", "poboy", "gumbo", "beignet", "jambalaya",
  "ya ka mein", "yakamein", "mango freeze", "cochon", "muffuletta",
];
const NEXT_PHRASES = [
  "who is after", "whos after", "who's after",
  "who is next", "whos next", "who's next",
  "who is playing after", "whos playing after", "who's playing after",
  "next after", "next on", "who follows", "who plays after",
  "what is after", "whats after", "what's after",
  "what is playing after", "what's playing after", "whats playing after",
  "after them", "after him", "after her", "after that",
];
const PREV_PHRASES = [
  "who is before", "whos before", "who's before",
  "who is playing before", "whos playing before", "who's playing before",
  "who played before", "who plays before", "who will play before",
  "who was before", "who performed before",
  "what is before", "whats before", "what's before",
  "what is playing before", "what's playing before", "whats playing before",
  "what was before", "what played before",
  "before them", "before him", "before her", "before that",
  "who is earlier", "who was earlier", "one before",
  "who opens for", "who opened for",
];
const PRONOUN_PHRASES = ["them", "they", "him", "her", "that band", "that artist", "that one", "those guys"];
// Stage-referring pronouns / deictics — resolved against context.lastStage.
const STAGE_PRONOUN_PHRASES = ["there", "that stage", "same stage", "this stage"];
// Day-referring pronouns / deictics — resolved against context.lastDay.
const DAY_PRONOUN_PHRASES = ["that day", "same day", "then"];
const HEADLINER_PHRASES = [
  "headliner", "headliners", "headlining", "headline",
  "headline act", "headline acts", "headlining act", "headlining acts",
  "main act", "main acts", "main artist", "main artists",
  "main performance", "main performer",
  "who is closing", "whos closing", "who's closing",
  "closing set", "closing sets", "closer", "closers",
  "final set", "final sets", "last set of the day",
  "last act", "last show", "last performance",
  "who is last", "whos last", "who's last",
  "who closes",
  // Natural-language closer phrases
  "who ends", "what ends", "ends the", "ends on",
  "who finishes", "who wraps",
  "evening act", "final act",
];
const CONFLICT_PHRASES = [
  "conflict", "conflicts", "conflicting",
  "overlap", "overlaps", "overlapping",
  "same time", "competing", "clash", "clashes",
  "what else is on", "during ",
];
const TIME_WINDOW_PHRASES = [
  "tonight", "later today", "later this afternoon", "rest of the day",
  "in the next hour", "next hour", "next 30", "next thirty",
  "in 30 minutes", "coming up", "upcoming",
];
const GENRE_LIST_PHRASES = [
  "any ", "show me ", "find ", "list ", "show all", "what ",
  "anything ", "i want ", "looking for",
];

// Clear signals that the user is asking about cultural programming
// (Folklife Village, Cultural Exchange Pavilion exhibits / artist demos),
// NOT about music schedules.
const CULTURAL_PHRASES = [
  "folklife", "folk life",
  "cultural exchange", "cultural pavilion",
  "jamaica pavilion", "jamaica exhibit",
  "jamaica artist", "jamaica artists", "jamaican artist", "jamaican artists",
  "exhibit", "exhibits", "exhibition",
  "craft demonstration", "craft demo", "artist demonstration", "artist demo",
  "straw weaving", "sign painter", "ceramic artist",
  "native american village", "native american",
  "mardi gras indian craft", "mardi gras indians",
  "tent b", "tent c", "tent d", "tent g", "past meets pixel",
  "mariachi",
];

// FAQ-style question starters (not festival data). Used as a soft signal —
// FAQ matching is primarily keyword-based against the FAQ entries themselves.
const FAQ_QUESTION_STARTERS = [
  "can i ", "may i ", "am i allowed", "do you allow",
  "is there ", "are there ", "do they ", "do you ",
  "how do i ", "how can i ", "where can i ", "how much",
];

// ---- Classification ----

// Bare queries that should resolve to "now playing" — short, contextless
// phrases people send mid-festival. Whole-query exact match only, so they
// don't hijack longer queries like "who is playing on Festival Stage".
const BARE_NOW_QUERIES = new Set(
  [
    "now", "right now",
    "who is playing", "whos playing", "who s playing",
    "what is playing", "whats playing", "what s playing",
    "who is on", "whos on", "who s on",
    "what s on", "whats on",
  ].map(norm).filter(Boolean),
);

// Pre-normalize phrase lists so "who's after" (with apostrophe) compares
// correctly against the normed query (which strips apostrophes).
const NORMED_NOW = NOW_PHRASES.map(norm).filter(Boolean);
const NORMED_NEXT = NEXT_PHRASES.map(norm).filter(Boolean);
const NORMED_PREV = PREV_PHRASES.map(norm).filter(Boolean);
const NORMED_HEADLINER = HEADLINER_PHRASES.map(norm).filter(Boolean);
const NORMED_CONFLICT = CONFLICT_PHRASES.map(norm).filter(Boolean);
const NORMED_TIME_WINDOW = TIME_WINDOW_PHRASES.map(norm).filter(Boolean);
const NORMED_TIME = TIME_PHRASES.map(norm).filter(Boolean);
const NORMED_BIO = BIO_PHRASES.map(norm).filter(Boolean);
const NORMED_STAGE = STAGE_PHRASES.map(norm).filter(Boolean);
const NORMED_FOOD = FOOD_PHRASES.map(norm).filter(Boolean);
const NORMED_GENRE_LIST = GENRE_LIST_PHRASES.map(norm).filter(Boolean);
const NORMED_CULTURAL = CULTURAL_PHRASES.map(norm).filter(Boolean);
const NORMED_FAQ_STARTERS = FAQ_QUESTION_STARTERS.map(norm).filter(Boolean);

// Detects questions about the festival's own schedule — gate open/close,
// "what time does the fest end", "when do gates open", etc.
// REQUIRES an explicit festival reference ("fest", "festival", "jazz fest",
// "gates", "doors"). Implicit "it" is NOT routed here — those queries are
// ambiguous and resolve via the now/next default during festival days.
function isFestivalHoursQuery(normQuery: string): boolean {
  const hasTimeWord =
    /\b(when|what\s+time)\b/.test(normQuery) || /\bhours?\b/.test(normQuery);
  if (!hasTimeWord) return false;
  const hasHoursVerb =
    /\b(start|starts|started|begin|begins|open|opens|opened|opening|close|closes|closed|closing|end|ends|ending|over|done|finish|finishes|finished|run|runs|hours?)\b/.test(
      normQuery,
    );
  if (!hasHoursVerb) return false;
  return /\b(fest|festival|jazz\s*fest|gates?|doors?)\b/.test(normQuery);
}

// Catches ambiguous "what's happening" / "what time does it start" / "what's
// going on" queries with no specific subject. During a festival day these
// should default to now-or-next-today rather than festival hours or
// artist_lookup. Outside a festival day they fall through to the FAQ.
function isAmbiguousTimeQuery(normQuery: string): boolean {
  // "what's happening", "what's going on", "anything happening"
  if (/\b(whats|what s)\s+(happening|going on)\b/.test(normQuery)) return true;
  if (/\banything\s+(happening|going on)\b/.test(normQuery)) return true;
  // "what time does it (start|begin|open)" / "when does it (start|begin)"
  // — implicit "it" with hours-verb, no specific subject.
  const hasIt = /\b(it|its)\b/.test(normQuery);
  if (!hasIt) return false;
  const asksHours =
    /\b(start|starts|begin|begins|open|opens|opening|happening)\b/.test(normQuery);
  if (!asksHours) return false;
  const hasTimeWord = /\b(when|what\s+time)\b/.test(normQuery);
  if (!hasTimeWord) return false;
  // Ambiguous only when no competing subject is present.
  return !findArtist(normQuery) && !findStage(normQuery);
}

// Curated phrases that signal open-ended hunger / food discovery.
const FOOD_RECOMMENDATION_PHRASES = [
  "i m hungry", "im hungry", "i am hungry",
  "what should i eat", "what should i get",
  "food recommendations", "food recommendation", "food suggestions", "food suggestion",
  "recommend food", "recommend a food",
  "surprise me", "what s good", "whats good", "what s good to eat", "whats good to eat",
  "best food", "must try", "must try food", "must try foods",
  "famous food", "famous foods", "iconic food", "iconic foods",
  "top food", "top foods", "top picks", "top pick",
  "i don t know what i want", "i dont know what i want",
  "what food should i get", "what food should i eat",
  "what to eat", "things to eat",
];
const NORMED_FOOD_RECS = FOOD_RECOMMENDATION_PHRASES.map(norm).filter(Boolean);

function isFoodRecommendationQuery(normQuery: string): boolean {
  return NORMED_FOOD_RECS.some((p) => normQuery.includes(p));
}

// "Surprise me" is a discovery flow. Phrases that should trigger it.
const SURPRISE_PHRASES = [
  "surprise me", "surprise",
  "what should i do", "what to do",
  "anything cool", "something cool", "show me something",
  "hidden gem", "hidden gems",
  "i m bored", "im bored", "i am bored",
  "discover", "discovery",
  "off the beaten path",
  "show me a surprise",
];
const NORMED_SURPRISE = SURPRISE_PHRASES.map(norm).filter(Boolean);

function isSurpriseQuery(normQuery: string): boolean {
  // Whole-word boundaries so "surprise" doesn't match inside other words.
  return NORMED_SURPRISE.some((p) =>
    new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(normQuery),
  );
}

// Detect whether the user picked food / music / culture. Used both inside
// the surprise handler and to resolve a pending category prompt.
type SurpriseCategory = "food" | "music" | "culture";

// Subjective qualifiers that signal "give me an opinion / editor pick"
// rather than a literal lookup.
const SUBJECTIVE_QUALIFIER_RE =
  /\b(best|favorite|favourite|must\s?try|must\s?eat|must\s?have|must\s?see|cant\s?miss|can\s?t\s?miss|top|iconic|famous|recommend|recommended|highly\s?recommend|standout|standouts|killer|legendary|crushing|underrated|hidden|sleeper)\b/;

// Map subjective categories. Order matters — first match wins, so put more
// specific phrases first.
const REC_CATEGORY_RULES: { keywords: RegExp; category: string }[] = [
  { keywords: /\b(po\s?boy|poboy|po\s?boys|poboys)\b/, category: "po-boy" },
  { keywords: /\b(rib|ribs)\b/, category: "ribs" },
  { keywords: /\b(oyster|oysters)\b/, category: "oysters" },
  { keywords: /\b(gumbo)\b/, category: "gumbo" },
  { keywords: /\b(beignet|beignets|praline|pralines|sweet|sweets|dessert|desserts)\b/, category: "dessert" },
  { keywords: /\b(drink|drinks|cocktail|cocktails|booze|alcohol|punch)\b/, category: "drink" },
  { keywords: /\b(crawfish|crawdad|crawdads)\b/, category: "crawfish" },
  { keywords: /\b(taco|tacos)\b/, category: "tacos" },
  { keywords: /\b(soup|stew|stews|bisque)\b/, category: "soup" },
  { keywords: /\b(jamaican|caribbean|jamaica)\b/, category: "jamaican" },
  { keywords: /\b(duck)\b/, category: "duck" },
  { keywords: /\b(boudin)\b/, category: "boudin" },
  { keywords: /\b(pork|pig|cochon|swine)\b/, category: "pork" },
  { keywords: /\b(seafood|fish)\b/, category: "seafood" },
  { keywords: /\b(vegetarian|vegan|veggie)\b/, category: "vegetarian-friendly" },
  { keywords: /\b(appetizer|appetizers|small\s?plate|small\s?plates|snack|snacks|bite|bites|share|sharing)\b/, category: "appetizer" },
  { keywords: /\b(band|bands|act|acts|artist|artists|set|sets|show|shows|music)\b/, category: "music" },
  // Generic catch-alls — must be last so specific categories win.
  { keywords: /\b(food|eat|dish|dishes|meal|plate|plates)\b/, category: "must-try" },
];

function detectRecCategory(normQuery: string): string | null {
  for (const { keywords, category } of REC_CATEGORY_RULES) {
    if (keywords.test(normQuery)) return category;
  }
  return null;
}

function isSubjectiveQuery(normQuery: string): boolean {
  if (!SUBJECTIVE_QUALIFIER_RE.test(normQuery)) return false;
  return detectRecCategory(normQuery) !== null;
}

// Specific food-item keywords. When one of these appears in the query, the
// user is asking about an actual edible thing — vendor lookup should beat
// any incidental artist match (e.g. a Food Heritage Stage demo whose title
// includes the same word).
const FOOD_ITEM_KEYWORDS_RE =
  /\b(crawfish|po\s?boy|poboy|gumbo|beignet|beignets|jambalaya|ya\s?ka\s?mein|yakamein|mango\s+freeze|cochon|muffuletta|rib|ribs|oyster|oysters|boudin|etouffee|étouffée|remoulade|praline|pralines|shrimp|alligator|andouille|jerk|enchilada|strudel|sack|patty|patties|po\s+boys?|jambalaya|gyro|tacos?|wings?|fries|fried\s+chicken|catfish|crawdad|crawdads|stew|bisque|chowder|tamale|tamales|empanada|empanadas)\b/;

function hasFoodItemKeyword(normQuery: string): boolean {
  return FOOD_ITEM_KEYWORDS_RE.test(normQuery);
}

function detectSurpriseCategory(normQuery: string): SurpriseCategory | null {
  if (/\b(food|eat|hungry|snack|drink|drinks|bite|bites|taste)\b/.test(normQuery)) {
    return "food";
  }
  if (/\b(music|band|bands|artist|artists|song|songs|set|sets|show|shows)\b/.test(normQuery)) {
    return "music";
  }
  if (
    /\b(culture|cultural|folklife|folk\s*life|exhibit|exhibits|exhibition|demo|demos|demonstration|craft|crafts|heritage|tradition|traditions)\b/.test(
      normQuery,
    )
  ) {
    return "culture";
  }
  return null;
}

// FAQ relevance scoring — returns the best FAQ, or null. Uses word-boundary
// matching so "hat" doesn't hit inside "what" and "where" doesn't always fire.
function scoreFaq(query: string): { faq: FAQ; score: number } | null {
  const q = norm(query);
  if (!q) return null;
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let best: { faq: FAQ; score: number } | null = null;
  for (const f of faqs) {
    let s = 0;
    for (const kw of f.keywords) {
      const nkw = norm(kw);
      if (!nkw) continue;
      const re = new RegExp(`\\b${escape(nkw)}\\b`);
      if (re.test(q)) {
        // Multi-word keyword matches are much more specific than single words.
        s += nkw.split(" ").length >= 2 ? 3 : 1;
      }
    }
    if (s > 0 && (!best || s > best.score)) best = { faq: f, score: s };
  }
  return best;
}

export function classify(query: string): Intent {
  const q = norm(query);
  if (!q) return "unknown";

  // 0. CULTURAL — explicit folklife / exhibit / pavilion-programming signal.
  //    Checked first so "what's at the cultural exchange pavilion" doesn't
  //    get hijacked by the stage_lookup fallback.
  if (NORMED_CULTURAL.some((p) => q.includes(p))) return "cultural_lookup";

  // 0.15. SURPRISE ME — discovery flow. Routes to a curated surprise across
  //       food, music, or cultural programming (preferring hidden gems over
  //       headliners). Checked before food_recommendations so "surprise me"
  //       takes precedence over "what's good".
  if (isSurpriseQuery(q)) return "surprise_me";

  // 0.18. SUBJECTIVE RECOMMENDATIONS — "best ribs", "must try po-boy",
  //       "can't miss band today". Pulls from a curated editor-pick dataset
  //       (Ian McNulty + crowd favorites). Requires both a qualifier word
  //       AND a category noun, otherwise falls through to food_recs / others.
  if (isSubjectiveQuery(q)) return "subjective_recommendation";

  // 0.2. FOOD RECOMMENDATIONS — open-ended hunger ("i'm hungry", "what
  //      should i eat"). Surfaces curated must-try picks instead of
  //      dead-ending in unknown.
  if (isFoodRecommendationQuery(q)) return "food_recommendations";

  // 0.25. FESTIVAL HOURS — "what time does jazz fest start", "when do gates
  //       open", "is the festival over". Explicit festival reference only.
  //       Implicit "it" is NOT routed here (see ambiguous-time below).
  if (isFestivalHoursQuery(q)) return "faq_lookup";

  // 0.26. AMBIGUOUS TIME — "what time does it start", "what's happening".
  //       During a festival day → now_playing. Off-day → festival hours FAQ.
  if (isAmbiguousTimeQuery(q)) {
    const { day } = getFestivalNow();
    return day ? "now_playing" : "faq_lookup";
  }

  // 0.5. FAQ — strong match runs EARLY so "is jazz fest cashless" doesn't
  //      get hijacked by the "jazz" genre token. Two triggers:
  //        (a) any FAQ keyword is multi-word (precise, score ≥ 3)
  //        (b) query is short (≤ 2 meaningful tokens) and matches a keyword
  const faqEarly = scoreFaq(q);
  if (faqEarly) {
    if (faqEarly.score >= 3) return "faq_lookup";
    const qT = tokens(q);
    if (qT.length <= 2 && faqEarly.score >= 1) return "faq_lookup";
  }

  // 1. NEXT — "who's after X"
  if (NORMED_NEXT.some((p) => q.includes(p))) return "next_on_stage";

  // 1b. PREV — "who's before X" / "who opened for X"
  if (NORMED_PREV.some((p) => q.includes(p))) return "prev_on_stage";

  // 1c. HEADLINER — "who is headlining" / "who is closing" / "last set"
  //     Must be checked before day_lookup so "who is headlining Thursday"
  //     doesn't fall through to a full-day lineup.
  if (NORMED_HEADLINER.some((p) => q.includes(p))) return "headliner_lookup";

  // 2. CONFLICT — "what overlaps with X"
  if (NORMED_CONFLICT.some((p) => q.includes(p))) return "conflict_lookup";

  // 3. NOW — "who's playing now"
  if (NORMED_NOW.some((p) => q.includes(p))) return "now_playing";

  // 3a. Bare-now exact-match: "Now", "Who is playing", "What's on" alone.
  if (BARE_NOW_QUERIES.has(q)) return "now_playing";

  // 3b. STAGE-PRONOUN — "what's next there?", "anything on that stage Sunday?".
  //     Resolved in handleStageLookup against context.lastStage. Only fires
  //     when no explicit stage name is in the query (otherwise the normal
  //     stage rules win).
  const hasStagePronounRef = STAGE_PRONOUN_PHRASES.some((p) =>
    new RegExp(`\\b${p}\\b`).test(q),
  );
  if (hasStagePronounRef && !findStage(q) && !findArtist(q)) return "stage_lookup";

  // 4. TIME WINDOW — "tonight", "later today", "next hour"
  if (NORMED_TIME_WINDOW.some((p) => q.includes(p))) return "time_window";

  // 5. Specific clock time without "what time does X play" → time_window.
  // Pass the RAW query to hasClockTime — norm() strips colons.
  if (hasClockTime(query) && !NORMED_TIME.some((p) => q.includes(p))) return "time_window";

  // 6. "What time does X play" → artist_lookup
  if (NORMED_TIME.some((p) => q.includes(p))) return "artist_lookup";

  // 7. STAGE + DAY → stage_lookup (with day filter).
  //    Checked BEFORE genre so "Blues Tent Friday" routes to the stage, not
  //    the blues genre.
  const stage = findStage(q);
  if (stage && findDays(q).length > 0 && !findArtist(q)) return "stage_lookup";

  // 8. GENRE — only when there's no specific artist match,
  //    and no explicit stage in the query.
  const genres = findGenres(q);
  if (genres.length > 0 && !stage) {
    const hasDay = findDays(q).length > 0;
    const isListy = NORMED_GENRE_LIST.some((p) => q.includes(p));
    if (hasDay || isListy || !findArtist(q)) return "genre_lookup";
  }

  // 9. DAY lookup (only if no specific artist hijacks the query)
  if (findDays(q).length > 0 && !findArtist(q)) return "day_lookup";

  // 10. STAGE alone
  if (stage && NORMED_STAGE.some((p) => q.includes(p))) return "stage_lookup";
  if (stage && !findArtist(q)) return "stage_lookup";

  // 11. BIO — only if we can actually find a matching artist
  if (NORMED_BIO.some((p) => q.startsWith(p) || q.includes(` ${p.trim()} `))) {
    return findArtist(q) ? "artist_bio" : "unknown";
  }

  // 12. FOOD — but defer to artist_lookup if the query names a specific
  //     artist. "Where is Stevie Nicks playing" is asking about her stage,
  //     not a food vendor.
  //
  //     Counter-rule: when the artist match is a Food Heritage Stage cooking
  //     demo AND the query mentions a food-item keyword (crawfish, gumbo,
  //     etc.), prefer vendor lookup. "Where is the crawfish bread" should
  //     return Panaroma Foods, not John Malone's demo whose title happens
  //     to contain "crawfish" and "bread".
  if (NORMED_FOOD.some((p) => q.includes(p))) {
    const artistMatch = findArtist(q);
    if (artistMatch) {
      const isFoodHeritageDemo = artistMatch.stage === "Food Heritage Stage";
      if (isFoodHeritageDemo && hasFoodItemKeyword(q)) return "food_lookup";
      return "artist_lookup";
    }
    return "food_lookup";
  }

  // 12. Fallbacks
  if (findArtist(q)) return "artist_lookup";
  if (findVendorsByFood(q).length > 0) return "food_lookup";
  if (stage) return "stage_lookup";

  // 13. FAQ — keyword match against the FAQ index. Only fires as a last
  //    resort so it doesn't steal music/food queries.
  const faqMatch = scoreFaq(q);
  if (faqMatch && (faqMatch.score >= 3 || NORMED_FAQ_STARTERS.some((p) => q.startsWith(p)))) {
    return "faq_lookup";
  }

  return "unknown";
}

// ---- Response builders ----

function festivalDayIndex(day: string): number {
  const order = festivalDays.map((d) => d.day);
  const i = order.indexOf(day as FestivalDay);
  return i === -1 ? 99 : i;
}

// Convert a festival day to a friendly relative label based on today.
// "Sat Apr 25" → "Today (Sat Apr 25)" if today is Apr 25, etc. Falls back
// to the bare day name if today isn't a festival day or the diff is > 1.
function formatRelativeDay(day: FestivalDay): string {
  const today = getFestivalNow().day;
  if (!today) return day;
  const diff = festivalDayIndex(day) - festivalDayIndex(today);
  if (diff === 0) return `Today (${day})`;
  if (diff === 1) return `Tomorrow (${day})`;
  if (diff === -1) return `Yesterday (${day})`;
  return day;
}

function artistLine(a: Artist) {
  return `• ${a.artist_name} — ${a.day}, ${formatTime(a.start_time)}–${formatTime(a.end_time)} on ${a.stage}`;
}

// Compact bullet that drops day/stage when the surrounding context already
// pins them (e.g. listing a single stage's lineup for one day).
function artistLineCompact(a: Artist, opts: { hideDay?: boolean; hideStage?: boolean } = {}) {
  const time = `${formatTime(a.start_time)}–${formatTime(a.end_time)}`;
  const parts = [a.artist_name, time];
  if (!opts.hideDay) parts.push(a.day);
  if (!opts.hideStage) parts.push(a.stage);
  return `• ${parts.join(" · ")}`;
}

// Find the closest artist guess by edit distance against full names AND
// individual name tokens. Used to drive "Did you mean X?" suggestions when
// strict matching fails. Returns null if nothing comes within budget.
function findClosestArtistGuess(query: string): Artist | null {
  const q = norm(query);
  if (!q || q.length < 3) return null;
  if (BARE_NON_ARTIST_WORDS.has(q)) return null;

  const qTokens = q.split(" ").filter((t) => t.length >= 3);
  if (qTokens.length === 0) return null;

  let best: { artist: Artist; score: number } | null = null;
  for (const a of artists) {
    const name = norm(a.artist_name);
    const nameTokens = name.split(" ").filter((t) => t.length >= 3);

    // (a) Best token-pair edit distance, normalized by length.
    let bestTokenScore = Infinity;
    for (const qt of qTokens) {
      for (const nt of nameTokens) {
        if (qt[0] !== nt[0]) continue; // first-letter agreement
        if (Math.abs(qt.length - nt.length) > 3) continue;
        const d = editDistance(qt, nt);
        const longer = Math.max(qt.length, nt.length);
        // Normalize: distance / longer. Lower is better.
        const normalized = d / longer;
        if (normalized < bestTokenScore) bestTokenScore = normalized;
      }
    }

    // (b) Full-name distance (caps the score in the noisy long-name case).
    const fullDistance = q.length >= 4 ? editDistance(q, name) / Math.max(q.length, name.length) : Infinity;

    const combined = Math.min(bestTokenScore, fullDistance);
    if (combined === Infinity) continue;
    if (!best || combined < best.score) {
      best = { artist: a, score: combined };
    }
  }
  // Threshold: 0.5 normalized distance — roughly "half the chars match".
  // Empirically catches "Frida"→"Freedia" (0.43), "Naz"→"Nas" (0.33),
  // and rejects unrelated noise.
  if (best && best.score <= 0.5) return best.artist;
  return null;
}

function noArtistFound(query: string): string {
  const guess = findClosestArtistGuess(query);
  if (guess) return `I didn't catch that — did you mean ${guess.artist_name}?`;
  return "I'm not finding that one. Try an artist name, stage name, or food item.";
}

function disambiguationLine(a: Artist) {
  return `• ${a.artist_name} — ${a.day}, ${formatTime(a.start_time)}–${formatTime(a.end_time)} on ${a.stage}`;
}

// Apply a day filter to artist matches when the query references a day
// ("today", "tomorrow", "Saturday", "May 2", etc.). Returns:
//   - { filtered }: matches narrowed to the requested day(s); empty if the
//     artist exists but isn't playing then.
//   - null: no day reference in the query, caller should use raw matches.
function filterMatchesByDay(
  query: string,
  matches: Artist[],
): { filtered: Artist[]; requestedDays: FestivalDay[] } | null {
  const days = findDays(query);
  if (days.length === 0) return null;
  const daySet = new Set(days);
  return {
    filtered: matches.filter((a) => daySet.has(a.day as FestivalDay)),
    requestedDays: days,
  };
}

// When multiple matches all refer to the same artist (e.g. Big Freedia plays
// twice over the two weekends), prefer today's set if the user didn't pin
// a day. "Is Big Freedia playing?" mid-festival reads as "playing today?".
function preferTodayWhenSameArtist(matches: Artist[]): Artist[] {
  if (matches.length <= 1) return matches;
  const uniqueNames = new Set(matches.map((m) => m.artist_name));
  if (uniqueNames.size > 1) return matches;
  const today = getFestivalNow().day;
  if (!today) return matches;
  const todayMatches = matches.filter((a) => a.day === today);
  return todayMatches.length >= 1 ? todayMatches : matches;
}

function artistNotOnDayResponse(
  matches: Artist[],
  requestedDays: FestivalDay[],
): { response: string; resolvedArtist?: string; resolvedStage?: string; resolvedDay?: FestivalDay } {
  const today = getFestivalNow().day;
  const todayIdx = today ? festivalDayIndex(today) : -1;
  // Chronological. Drop past sets relative to today — users at the festival
  // don't care about a set that already happened.
  const sorted = [...matches].sort(
    (a, b) => festivalDayIndex(a.day) - festivalDayIndex(b.day),
  );
  const upcoming =
    todayIdx >= 0
      ? sorted.filter((a) => festivalDayIndex(a.day) >= todayIdx)
      : sorted;

  const dayLabel =
    requestedDays.length === 1 ? formatRelativeDay(requestedDays[0]) : "that day";
  const name = sorted[0].artist_name;

  if (upcoming.length === 0) {
    return {
      response: `${name} isn't playing ${dayLabel}. Their sets at this fest already happened.`,
      resolvedArtist: name,
    };
  }

  const next = upcoming[0];
  const nextDayLabel = formatRelativeDay(next.day as FestivalDay);
  const lines = [
    `${name} isn't playing ${dayLabel}.`,
    `Next set: ${nextDayLabel}, ${formatTime(next.start_time)}–${formatTime(next.end_time)} on ${next.stage}.`,
  ];
  if (upcoming.length > 1) {
    lines.push("");
    lines.push("Other upcoming sets:");
    lines.push(
      ...upcoming.slice(1).map(
        (a) =>
          `• ${formatRelativeDay(a.day as FestivalDay)}, ${formatTime(a.start_time)}–${formatTime(a.end_time)} on ${a.stage}`,
      ),
    );
  }
  return {
    response: lines.join("\n"),
    resolvedArtist: name,
    resolvedStage: next.stage,
    resolvedDay: next.day as FestivalDay,
  };
}

// Reject overly-broad queries that produce a sea of matches. Most real
// users don't want a 40-line dump — they want to refine.
function isOverlyBroadQuery(query: string, matches: Artist[]): boolean {
  const q = norm(query);
  const wordCount = q ? q.split(" ").filter(Boolean).length : 0;
  // Single-word queries that pulled in 11+ matches are almost always too
  // generic to be useful (e.g. "all", "show", "any", "new").
  return wordCount <= 1 && matches.length > 10;
}

const BROAD_QUERY_RESPONSE =
  "That's a broad one — try an artist name, stage, or food item. Examples: \"Lorde\", \"Festival Stage\", \"Mango Freeze\".";

export function handleArtistLookup(query: string): {
  response: string;
  resolvedArtist?: string;
  resolvedStage?: string;
  resolvedDay?: FestivalDay;
} {
  let matches = findArtists(query);
  if (isOverlyBroadQuery(query, matches)) {
    return { response: BROAD_QUERY_RESPONSE };
  }
  const dayFilter = filterMatchesByDay(query, matches);
  if (dayFilter) {
    if (dayFilter.filtered.length === 0 && matches.length > 0) {
      return artistNotOnDayResponse(matches, dayFilter.requestedDays);
    }
    matches = dayFilter.filtered;
  } else if (matches.length > 1) {
    // No explicit day in the query. If all matches are the same artist
    // playing multiple festival days and one of them is today, prefer
    // today's set — at the festival "is X playing?" almost always means
    // "is X playing today?".
    matches = preferTodayWhenSameArtist(matches);
  }
  if (matches.length > 10) {
    return { response: BROAD_QUERY_RESPONSE };
  }
  if (matches.length > 1) {
    return {
      response: [
        `${matches.length} matches for "${query}". Which one?`,
        ...matches.map(disambiguationLine),
      ].join("\n"),
      resolvedArtist: matches[0].artist_name,
    };
  }
  const a = matches[0];
  if (!a) return { response: noArtistFound(query) };
  const normQ = norm(query);
  // Strict literal verbs only — don't conflate "when does" / "what time"
  // (general time questions) with "start". The user asked when the set
  // ENDS; lead with the end time.
  const asksEnd = /\b(end|ends|ending|over|done|finish|finishes|until|till)\b/.test(normQ);
  const asksStart = /\b(start|starts|starting|begin|begins|beginning)\b/.test(normQ);
  const dayLabel = formatRelativeDay(a.day as FestivalDay);
  if (asksEnd && !asksStart) {
    return {
      response: [
        `${a.artist_name}`,
        `Ends at ${formatTime(a.end_time)}`,
        `${dayLabel} · ${formatTime(a.start_time)}–${formatTime(a.end_time)}`,
        `${a.stage}`,
      ].join("\n"),
      resolvedArtist: a.artist_name,
      resolvedStage: a.stage,
      resolvedDay: a.day as FestivalDay,
    };
  }
  return {
    response: [
      `${a.artist_name}`,
      `${dayLabel} · ${formatTime(a.start_time)}–${formatTime(a.end_time)}`,
      `${a.stage}`,
    ].join("\n"),
    resolvedArtist: a.artist_name,
    resolvedStage: a.stage,
    resolvedDay: a.day as FestivalDay,
  };
}

export function handleArtistBio(query: string): {
  response: string;
  resolvedArtist?: string;
  resolvedStage?: string;
  resolvedDay?: FestivalDay;
} {
  let matches = findArtists(query);
  if (isOverlyBroadQuery(query, matches)) {
    return { response: BROAD_QUERY_RESPONSE };
  }
  const dayFilter = filterMatchesByDay(query, matches);
  if (dayFilter) {
    if (dayFilter.filtered.length === 0 && matches.length > 0) {
      return artistNotOnDayResponse(matches, dayFilter.requestedDays);
    }
    matches = dayFilter.filtered;
  } else if (matches.length > 1) {
    matches = preferTodayWhenSameArtist(matches);
  }
  if (matches.length > 10) {
    return { response: BROAD_QUERY_RESPONSE };
  }
  if (matches.length > 1) {
    return {
      response: [
        `${matches.length} matches for "${query}". Which one?`,
        ...matches.map(disambiguationLine),
      ].join("\n"),
      resolvedArtist: matches[0].artist_name,
    };
  }
  const a = matches[0];
  if (!a) return { response: noArtistFound(query) };
  const dayLabel = formatRelativeDay(a.day as FestivalDay);
  return {
    response: [
      `${a.artist_name} (${a.genre})`,
      "",
      a.bio,
      "",
      `Playing ${dayLabel}, ${formatTime(a.start_time)}–${formatTime(a.end_time)} on ${a.stage}.`,
    ].join("\n"),
    resolvedArtist: a.artist_name,
    resolvedStage: a.stage,
    resolvedDay: a.day as FestivalDay,
  };
}

export function handleStageLookup(query: string, context?: AnswerContext): {
  response: string;
  pending?: PendingDisambiguation;
  resolvedStage?: string;
  resolvedDay?: FestivalDay;
} {
  let s = findStage(query);
  // "what's next there?" — resolve via lastStage if the query points to a
  // stage-pronoun and no explicit stage was parsed.
  if (!s && hasStagePronoun(query) && context?.lastStage) {
    s = stages.find((st) => st.stage_name === context.lastStage) ?? null;
  }
  if (!s) return { response: `No stage matches "${query}". Try: ${stages.map((x) => x.stage_name).join(", ")}.` };
  const days = findDays(query);
  if (days.length > 1) return whichDayPrompt(days, query);
  let sets = artists.filter((a) => a.stage === s.stage_name);
  let dayContext = "";
  let dayPinned: FestivalDay | null = days.length === 1 ? days[0] : null;
  // If the user didn't mention a day but the festival is live right now,
  // default to today — at the fest "what's on this stage" really means today.
  if (!dayPinned) {
    const today = getFestivalNow().day;
    if (today) dayPinned = today;
  }
  if (dayPinned) {
    sets = sets.filter((a) => a.day === dayPinned);
    dayContext = ` — ${dayPinned}`;
  }
  sets = sets.sort((a, b) => {
    const byDay = festivalDayIndex(a.day) - festivalDayIndex(b.day);
    if (byDay !== 0) return byDay;
    return toMinutes(a.start_time) - toMinutes(b.start_time);
  });
  if (sets.length === 0) {
    return {
      response: `${s.stage_name}${dayContext}\nNo sets in the current data.`,
      resolvedStage: s.stage_name,
      resolvedDay: dayPinned ?? undefined,
    };
  }
  // When a day is pinned, drop the description (filler) and the redundant
  // stage/day on each line. When no day is pinned (full-stage view), keep
  // the description and the day chip per line so the list is navigable.
  if (dayPinned) {
    return {
      response: [
        `${s.stage_name}${dayContext}:`,
        ...sets.map((a) => artistLineCompact(a, { hideDay: true, hideStage: true })),
      ].join("\n"),
      resolvedStage: s.stage_name,
      resolvedDay: dayPinned,
    };
  }
  return {
    response: [
      `${s.stage_name}${dayContext}`,
      s.description,
      "",
      ...sets.map((a) => artistLineCompact(a, { hideStage: true })),
    ].join("\n"),
    resolvedStage: s.stage_name,
  };
}

// Rank a stage for now-playing display. Lower index = higher priority.
// Stages not in the list go after, alphabetical.
function nowPlayingStageRank(stageName: string): number {
  const idx = HEADLINER_STAGE_ORDER.indexOf(stageName);
  return idx === -1 ? 99 : idx;
}

export function handleNowPlaying(query: string = ""): string {
  const { day, minutes } = getFestivalNow();
  if (!day) {
    return "Nothing playing right now — not a festival day. Try \"who's on Festival Stage\" or \"any funk on Saturday\".";
  }
  const stage = findStage(query);
  const onStage = (a: Artist) => !stage || a.stage === stage.stage_name;
  const label = stage ? `${stage.stage_name} now` : `Playing now (${day})`;

  const live = artists
    .filter(
      (a) =>
        a.day === day &&
        toMinutes(a.start_time) <= minutes &&
        toMinutes(a.end_time) > minutes &&
        onStage(a),
    )
    .sort((a, b) => {
      const r = nowPlayingStageRank(a.stage) - nowPlayingStageRank(b.stage);
      if (r !== 0) return r;
      return a.stage.localeCompare(b.stage);
    });
  if (live.length > 0) {
    // Single-stage, single-set → tight answer.
    if (stage && live.length === 1) {
      const a = live[0];
      return [
        a.artist_name,
        `${formatTime(a.start_time)}–${formatTime(a.end_time)}`,
        `${a.stage} · ${a.day}`,
      ].join("\n");
    }
    return [
      `${label}:`,
      ...live.map((a) => artistLineCompact(a, { hideDay: true, hideStage: Boolean(stage) })),
    ].join("\n");
  }

  const upcoming = artists
    .filter((a) => a.day === day && toMinutes(a.start_time) > minutes && onStage(a))
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time))
    .slice(0, stage ? 3 : 4);
  if (upcoming.length === 0) {
    return stage
      ? `Nothing left on ${stage.stage_name} today (${day}).`
      : `No sets left today (${day}).`;
  }
  const header = stage
    ? `Nothing on ${stage.stage_name} right now. Up next there:`
    : `Nothing on stage at the minute. Up next on ${day}:`;
  return [
    header,
    ...upcoming.map((a) => artistLineCompact(a, { hideDay: true, hideStage: Boolean(stage) })),
  ].join("\n");
}

function hasPronoun(query: string): boolean {
  const q = norm(query);
  return PRONOUN_PHRASES.some((p) => new RegExp(`\\b${p}\\b`).test(q));
}

function hasStagePronoun(query: string): boolean {
  const q = norm(query);
  return STAGE_PRONOUN_PHRASES.some((p) => new RegExp(`\\b${p}\\b`).test(q));
}

function hasDayPronoun(query: string): boolean {
  const q = norm(query);
  return DAY_PRONOUN_PHRASES.some((p) => new RegExp(`\\b${p}\\b`).test(q));
}

function resolveArtist(query: string, context?: AnswerContext): Artist | null {
  const direct = findArtist(query);
  if (direct) return direct;
  if (hasPronoun(query) && context?.lastArtist) return findArtist(context.lastArtist);
  return null;
}

export function handleNextOnStage(query: string, context?: AnswerContext): {
  response: string;
  resolvedArtist?: string;
  resolvedStage?: string;
  resolvedDay?: FestivalDay;
} {
  const target = resolveArtist(query, context);
  if (!target) {
    if (hasPronoun(query)) {
      return { response: "I don't know who you mean by that yet. Ask about a specific artist first, then follow up with \"who is after them?\"." };
    }
    return { response: "Tell me which artist. Try: \"who's after Lorde?\"" };
  }
  const sameStageSameDay = artists
    .filter((a) => a.stage === target.stage && a.day === target.day)
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
  const idx = sameStageSameDay.findIndex((a) => a.artist_name === target.artist_name);
  const next = idx >= 0 ? sameStageSameDay[idx + 1] : null;
  if (!next) {
    return {
      response: [
        `${target.artist_name} looks like the last set on ${target.stage} on ${target.day}.`,
        `Nothing listed after them in the current data.`,
      ].join("\n"),
      resolvedArtist: target.artist_name,
      resolvedStage: target.stage,
      resolvedDay: target.day as FestivalDay,
    };
  }
  return {
    response: [
      `After ${target.artist_name} on ${target.stage} (${target.day}):`,
      `${next.artist_name} — ${formatTime(next.start_time)}–${formatTime(next.end_time)}`,
    ].join("\n"),
    resolvedArtist: next.artist_name,
    resolvedStage: next.stage,
    resolvedDay: next.day as FestivalDay,
  };
}

export function handlePrevOnStage(query: string, context?: AnswerContext): {
  response: string;
  resolvedArtist?: string;
  resolvedStage?: string;
  resolvedDay?: FestivalDay;
} {
  const target = resolveArtist(query, context);
  if (!target) {
    if (hasPronoun(query)) {
      return { response: "I don't know who you mean by that yet. Ask about a specific artist first, then follow up with \"who's before them?\"." };
    }
    return { response: "Tell me which artist. Try: \"who's before Lorde?\"" };
  }
  const sameStageSameDay = artists
    .filter((a) => a.stage === target.stage && a.day === target.day)
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
  const idx = sameStageSameDay.findIndex((a) => a.artist_name === target.artist_name);
  const prev = idx > 0 ? sameStageSameDay[idx - 1] : null;
  if (!prev) {
    return {
      response: [
        `${target.artist_name} looks like the first set on ${target.stage} on ${target.day}.`,
        `Nothing listed before them in the current data.`,
      ].join("\n"),
      resolvedArtist: target.artist_name,
      resolvedStage: target.stage,
      resolvedDay: target.day as FestivalDay,
    };
  }
  return {
    response: [
      `Before ${target.artist_name} on ${target.stage} (${target.day}):`,
      `${prev.artist_name} — ${formatTime(prev.start_time)}–${formatTime(prev.end_time)}`,
    ].join("\n"),
    resolvedArtist: prev.artist_name,
    resolvedStage: prev.stage,
    resolvedDay: prev.day as FestivalDay,
  };
}

export function handleConflictLookup(query: string, context?: AnswerContext): { response: string; resolvedArtist?: string } {
  const target = resolveArtist(query, context);
  if (!target) {
    if (hasPronoun(query)) {
      return { response: "I don't know who you mean. Ask about a specific artist first, then \"what overlaps with them?\"." };
    }
    return { response: "Tell me which artist. Try: \"what overlaps with Stevie Nicks?\"" };
  }
  const ts = toMinutes(target.start_time);
  const te = toMinutes(target.end_time);
  const overlaps = artists
    .filter((a) => a.artist_name !== target.artist_name && a.day === target.day)
    .filter((a) => toMinutes(a.start_time) < te && toMinutes(a.end_time) > ts)
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
  if (overlaps.length === 0) {
    return {
      response: `Nothing else playing during ${target.artist_name} (${target.day}, ${formatTime(target.start_time)}–${formatTime(target.end_time)}) in the current data.`,
      resolvedArtist: target.artist_name,
    };
  }
  return {
    response: [
      `Overlapping with ${target.artist_name} (${target.day}, ${formatTime(target.start_time)}–${formatTime(target.end_time)}):`,
      ...overlaps.map(artistLine),
    ].join("\n"),
    resolvedArtist: target.artist_name,
  };
}

export function handleDayLookup(query: string, context?: AnswerContext): {
  response: string;
  pending?: PendingDisambiguation;
  resolvedDay?: FestivalDay;
} {
  let days = findDays(query);
  // Day-pronoun ("that day" / "same day" / "then") resolves via lastDay.
  if (days.length === 0 && hasDayPronoun(query) && context?.lastDay) {
    days = [context.lastDay];
  }
  if (days.length === 0) {
    return { response: "I couldn't figure out which day. Try 'Thursday', 'first Friday', or 'Sat May 2'." };
  }
  if (days.length > 1) {
    // Save options + original query so a short reply ("23", "first", "apr 30") resolves.
    return {
      response: [
        `Which one?`,
        ...days.map((d) => `• ${d}`),
        ``,
        `Reply with "23" / "30", "first" / "second", or the full date.`,
      ].join("\n"),
      pending: { kind: "day", options: days, originalQuery: query },
    };
  }
  const day = days[0];
  const sets = artists
    .filter((a) => a.day === day)
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
  if (sets.length === 0) return { response: `No sets listed for ${day}.`, resolvedDay: day };
  return {
    response: [`${day} lineup:`, ...sets.map((a) => `• ${formatTime(a.start_time)} — ${a.artist_name} (${a.stage})`)].join("\n"),
    resolvedDay: day,
  };
}

export function handleGenreLookup(query: string): { response: string; pending?: PendingDisambiguation } {
  const genres = findGenres(query);
  if (genres.length === 0) {
    return { response: "Tell me a genre. Try: \"any funk Saturday\" or \"show me blues acts\"." };
  }
  const days = findDays(query);
  if (days.length > 1) return whichDayPrompt(days, query);
  let pool = artists.filter((a) => matchesAnyGenre(a, genres));
  let dayContext = "";

  if (days.length === 1) {
    pool = pool.filter((a) => a.day === days[0]);
    dayContext = ` on ${days[0]}`;
  }
  const sorted = pool.sort((a, b) => {
    const byDay = festivalDayIndex(a.day) - festivalDayIndex(b.day);
    if (byDay !== 0) return byDay;
    return toMinutes(a.start_time) - toMinutes(b.start_time);
  });
  const label = genres.map((g) => g.charAt(0).toUpperCase() + g.slice(1)).join(" / ");
  if (sorted.length === 0) return { response: `No ${label} acts${dayContext}.` };
  return { response: [`${label} acts${dayContext}:`, ...sorted.map(artistLine)].join("\n") };
}

export function handleTimeWindow(query: string): { response: string; pending?: PendingDisambiguation } {
  // parseClockTime needs the raw query (colons intact). Everything else uses norm().
  const q = norm(query);
  const days = findDays(query);
  const clock = parseClockTime(query);
  const stage = findStage(query);

  let targetDay: FestivalDay | null = null;
  let windowStart: number;
  let windowEnd: number;
  let label: string;

  if (clock !== null) {
    // Ambiguous day + explicit time → ask which day. Preserve the query so the
    // follow-up turn re-runs the time+stage lookup once the day is pinned.
    if (days.length > 1) {
      return {
        response: [
          `Which day?`,
          ...days.map((d) => `• ${d}`),
          ``,
          `Reply with "23" / "30", "first" / "second", or the full date.`,
        ].join("\n"),
        pending: { kind: "day", options: days, originalQuery: query },
      };
    }
    targetDay = days[0] ?? getFestivalNow().day;
    if (!targetDay) {
      // Clock time given but no day, and today isn't a festival day.
      // Return pending with all 8 options so a reply like "friday" or "1" can
      // resolve or at least narrow to a new pending.
      const allDays = festivalDays.map((d) => d.day);
      return {
        response: [
          `Which day?`,
          ...allDays.map((d) => `• ${d}`),
          ``,
          `Reply with a day name, "23" / "24", "first Friday", or the full date.`,
        ].join("\n"),
        pending: { kind: "day", options: allDays, originalQuery: query },
      };
    }
    windowStart = clock;
    windowEnd = clock + 1; // any set covering this minute
    label = stage ? `${stage.stage_name} at ${formatMinutes(clock)}` : `On stage at ${formatMinutes(clock)}`;
  } else {
    const now = getFestivalNow();
    if (!now.day) {
      return { response: "Not a festival day right now. Try \"Saturday at 5pm\" or \"any funk Sunday\"." };
    }
    targetDay = now.day;
    if (q.includes("next hour") || q.includes("coming up") || q.includes("in 30") || q.includes("next 30") || q.includes("next thirty") || q.includes("in 30 minutes") || q.includes("upcoming")) {
      windowStart = now.minutes;
      windowEnd = now.minutes + 60;
      label = stage ? `${stage.stage_name} — next hour` : "Coming up in the next hour";
    } else if (q.includes("tonight")) {
      windowStart = Math.max(now.minutes, 18 * 60);
      windowEnd = 24 * 60;
      label = stage ? `${stage.stage_name} — tonight` : "Tonight";
    } else {
      windowStart = now.minutes;
      windowEnd = 24 * 60;
      label = stage ? `${stage.stage_name} — later today` : "Later today";
    }
  }

  let sets = artists
    .filter((a) => a.day === targetDay)
    .filter((a) => toMinutes(a.start_time) < windowEnd && toMinutes(a.end_time) > windowStart);
  if (stage) sets = sets.filter((a) => a.stage === stage.stage_name);
  sets = sets.sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
  if (sets.length === 0) {
    // Hyper-specific (stage + clock + day) with no set covering that minute:
    // surface the next set on that stage rather than a flat "nothing".
    if (stage && clock !== null && targetDay) {
      const upcoming = artists
        .filter((a) => a.day === targetDay && a.stage === stage.stage_name)
        .filter((a) => toMinutes(a.start_time) > windowStart)
        .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
      if (upcoming.length > 0) {
        const next = upcoming[0];
        return {
          response: [
            `Nothing on ${stage.stage_name} at ${formatMinutes(clock)} on ${targetDay}.`,
            `Up next: ${next.artist_name} — ${formatTime(next.start_time)}–${formatTime(next.end_time)}.`,
          ].join("\n"),
        };
      }
    }
    return { response: `${label} on ${targetDay}: nothing in the data.` };
  }
  // Hyper-specific query (one stage, one moment, one band) → tight answer.
  if (sets.length === 1 && stage) {
    const a = sets[0];
    return {
      response: [
        a.artist_name,
        `${formatTime(a.start_time)}–${formatTime(a.end_time)}`,
        `${a.stage} · ${a.day}`,
      ].join("\n"),
    };
  }
  return {
    response: [
      `${label} on ${targetDay}:`,
      ...sets.map((a) => artistLineCompact(a, { hideDay: true, hideStage: Boolean(stage) })),
    ].join("\n"),
  };
}

// ---- Cultural programming ----

function scoreDemo(query: string, demo: Demo): number {
  const q = norm(query);
  if (!q) return 0;
  let score = 0;
  const n = norm(demo.name);
  const a = norm(demo.area);
  const sa = demo.sub_area ? norm(demo.sub_area) : "";
  const c = norm(demo.category);
  // Direct name substring match is very strong.
  if (q.includes(n) || (n.length >= 4 && n.includes(q))) score += 10;
  // Token overlap with name (excluding stopwords).
  const qT = tokens(q);
  const nT = tokens(demo.name);
  const overlap = qT.filter((t) => nT.includes(t)).length;
  score += overlap * 3;
  // Area / sub-area / category mentions add context weight.
  if (a && q.includes(a)) score += 4;
  if (sa && q.includes(sa)) score += 3;
  if (c && q.includes(c)) score += 1;
  return score;
}

export function handleCulturalLookup(query: string): { response: string; pending?: PendingDisambiguation } {
  const q = norm(query);

  // If the query mentions a specific area, filter to that area's entries.
  const wantsFolklife = /\bfolk\s*life\b|\bfolklife\b/.test(q);
  const wantsPavilion = /cultural exchange|pavilion|jamaica/.test(q);
  const wantsExhibit = /\bexhibit(s|ion)?\b/.test(q);
  const wantsDemo = /\b(demo|demonstration|demonstrations)\b/.test(q);

  let pool = demos;
  const areaFilter: string[] = [];
  if (wantsFolklife) areaFilter.push("Louisiana Folklife Village");
  if (wantsPavilion) areaFilter.push("Sandals Resorts Jamaica Cultural Exchange Pavilion");
  if (areaFilter.length > 0) pool = pool.filter((d) => areaFilter.includes(d.area));
  if (wantsExhibit) pool = pool.filter((d) => d.category === "Exhibit");
  if (wantsDemo) pool = pool.filter((d) => /Demonstration|Performance|Digital/.test(d.category));

  // Optional day/weekend filter
  const days = findDays(query);
  if (days.length > 1) return whichDayPrompt(days, query);
  if (days.length === 1) {
    const W1 = new Set<string>(["Thu Apr 23", "Fri Apr 24", "Sat Apr 25", "Sun Apr 26"]);
    const weekend = W1.has(days[0]) ? "1" : "2";
    pool = pool.filter((d) => d.weekend === "both" || d.weekend === weekend);
  }

  // If the query is still broad, rank by relevance to the full query and trim.
  const scored = pool
    .map((d) => ({ demo: d, score: scoreDemo(query, d) }))
    .filter((x) => x.score > 0 || areaFilter.length > 0 || wantsExhibit || wantsDemo || days.length > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      response: [
        "I didn't find a cultural program matching that. Try:",
        "• \"What's in the Cultural Exchange Pavilion?\"",
        "• \"Folklife Village Saturday\"",
        "• \"Jamaica artists\"",
        "• \"Exhibits\"",
      ].join("\n"),
    };
  }

  // Group by area / sub_area for a cleaner list.
  const header =
    areaFilter.length === 1
      ? areaFilter[0]
      : wantsExhibit
      ? "Cultural Exchange Pavilion — Exhibits"
      : wantsDemo
      ? "Cultural demonstrations"
      : "Cultural programs";

  const show = scored.slice(0, 12).map((x) => {
    const d = x.demo;
    const tag = d.sub_area ? ` (${d.sub_area})` : "";
    const wk =
      d.weekend === "both" ? "Both weekends" : d.weekend === "1" ? "Weekend 1 (Apr 23–26)" : "Weekend 2 (Apr 30–May 3)";
    return `• ${d.name}${tag} — ${wk}\n  ${d.description}`;
  });
  const more = scored.length > 12 ? `\n\n…and ${scored.length - 12} more. Narrow the query to see them.` : "";
  return { response: [`${header}:`, "", ...show].join("\n") + more };
}

// ---- FAQ ----

export function handleFaqLookup(query: string): string {
  // Festival-hours shortcut: answer with gate times scoped to the requested
  // day when possible. Falls back to the full Dates & Hours FAQ otherwise.
  const normQuery = norm(query);
  if (isFestivalHoursQuery(normQuery)) {
    const days = findDays(query);
    // "today" / "tonight" with no festival day → say so explicitly.
    if (/\btoday\b|\btonight\b/.test(normQuery) && days.length === 0) {
      return "Today isn't a festival day. Jazz Fest 2026 runs Thu Apr 23 – Sun Apr 26 and Thu Apr 30 – Sun May 3. Gates open at 11 AM and close at 7 PM on fest days.";
    }
    if (days.length === 1) {
      const asksClose = /\b(close|closes|closed|closing|end|ends|ending|over|done|finish|finishes|finished)\b/.test(
        normQuery,
      );
      const asksOpen = /\b(start|starts|begin|begins|open|opens|opening)\b/.test(
        normQuery,
      );
      if (asksClose && !asksOpen) {
        return `${days[0]}: gates close at 7 PM.`;
      }
      if (asksOpen && !asksClose) {
        return `${days[0]}: gates open at 11 AM.`;
      }
      return `${days[0]}: gates open at 11 AM, close at 7 PM.`;
    }
    // No day pinned — return the full Dates & Hours FAQ.
    const hours = faqs.find((f) => f.topic === "Dates & Hours");
    if (hours) {
      return [`${hours.topic} — ${hours.question}`, "", hours.answer].join("\n");
    }
  }

  const best = scoreFaq(query);
  if (!best) {
    return "I don't have a FAQ entry for that. Try asking about tickets, parking, the shuttle, cashless payment, accessibility, or lost & found.";
  }
  return [`${best.faq.topic} — ${best.faq.question}`, "", best.faq.answer].join("\n");
}

// Stages ranked for headliner display. Main outdoor stages (where the true
// headliners play) come first. Non-music stages (Food Heritage, Kids Tent, etc.)
// are omitted — they don't really have "headliners" in the festival sense.
const HEADLINER_STAGE_ORDER = [
  "Festival Stage",
  "Shell Gentilly Stage",
  "Congo Square Stage",
  "Sheraton New Orleans Fais Do-Do Stage",
  "Jazz & Heritage Stage",
  "Blues Tent",
  "Gospel Tent",
  "Economy Hall Tent",
  "WWOZ Jazz Tent",
  "Lagniappe Stage",
  "Sandals Resorts Jamaica Cultural Exchange Pavilion",
];

export function handleHeadlinerLookup(query: string): { response: string; pending?: PendingDisambiguation } {
  const days = findDays(query);
  const stage = findStage(query);

  // Ambiguous day (e.g. bare "friday") — ask.
  if (days.length > 1) {
    return {
      response: [
        `Which day's headliners?`,
        ...days.map((d) => `• ${d}`),
        ``,
        `Reply with "23" / "30", "first" / "second", or the full date.`,
      ].join("\n"),
      pending: { kind: "day", options: days, originalQuery: query },
    };
  }

  // No day specified — ask.
  if (days.length === 0) {
    const allDays = festivalDays.map((d) => d.day);
    return {
      response: [
        `Which day's headliners?`,
        ...allDays.map((d) => `• ${d}`),
        ``,
        `Reply with a day name, "23" / "24", "first Friday", or the full date.`,
      ].join("\n"),
      pending: { kind: "day", options: allDays, originalQuery: query },
    };
  }

  const day = days[0];

  // For each stage, pick the artist whose start_time is latest that day.
  // Filter to HEADLINER_STAGE_ORDER to exclude non-music stages like Food
  // Heritage and Kids Tent.
  const stagesToShow = stage ? [stage.stage_name] : HEADLINER_STAGE_ORDER;
  const lines: string[] = [];
  for (const stageName of stagesToShow) {
    const setsOnStage = artists
      .filter((a) => a.day === day && a.stage === stageName)
      .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
    if (setsOnStage.length === 0) continue;
    const headliner = setsOnStage[setsOnStage.length - 1];
    lines.push(`• ${stageName}: ${headliner.artist_name} (${formatTime(headliner.start_time)}–${formatTime(headliner.end_time)})`);
  }

  if (lines.length === 0) {
    return {
      response: stage
        ? `No sets listed on ${stage.stage_name} for ${day}.`
        : `No sets listed for ${day}.`,
    };
  }

  const header = stage
    ? `${stage.stage_name} headliner — ${day}:`
    : `${day} headliners:`;
  return { response: [header, ...lines].join("\n") };
}

export function handleFoodLookup(query: string): string {
  const matches = findVendorsByFood(query);
  if (matches.length === 0) {
    return `No vendor matches "${query}". Try: crawfish bread, crawfish monica, cochon de lait, ya-ka-mein, beignets, mango freeze.`;
  }
  if (matches.length === 1) {
    const v = matches[0];
    return [`${v.vendor_name}`, `${v.location_description}`, `Serving: ${v.food_items.join(", ")}`].join("\n");
  }
  return matches.map((v) => `• ${v.vendor_name} — ${v.location_description}\n  ${v.food_items.join(", ")}`).join("\n\n");
}

// Curated must-try picks — the iconic Jazz Fest foods. Order matters
// (most-iconic first). Falls back gracefully if a vendor isn't in the data.
const POPULAR_FOOD_PICKS: { vendorMatch: string; foodItem: string }[] = [
  { vendorMatch: "Panaroma", foodItem: "Crawfish Bread" },
  { vendorMatch: "Big River", foodItem: "Crawfish Monica" },
  { vendorMatch: "WWOZ Community Radio", foodItem: "Mango Freeze" },
  { vendorMatch: "Walker's", foodItem: "Cochon de Lait Po-Boy" },
  { vendorMatch: "Cafe du Monde", foodItem: "Beignets" },
];

// ---- Subjective recommendations ("best X" / "must try Y" / "can't miss") ----

function recLine(r: Recommendation): string[] {
  return [
    `• ${r.title} — ${r.vendor} (${r.location})`,
    `  ${r.reason}`,
    `  Source: ${r.source}`,
  ];
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function handleCantMissMusic(): string {
  const today = getFestivalNow().day;
  // Three biggest stages — that's where the universally agreed "can't miss"
  // headliners play. Take the latest set on each.
  const mustStages = ["Festival Stage", "Shell Gentilly Stage", "Congo Square Stage"];
  if (today) {
    const picks = mustStages
      .map((stageName) => {
        const sets = artists
          .filter((a) => a.day === today && a.stage === stageName)
          .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
        return sets[sets.length - 1];
      })
      .filter(Boolean);
    if (picks.length > 0) {
      const lines: string[] = [`🎵 Can't-miss bands today (${today}):`, ""];
      for (const p of picks) {
        lines.push(
          `• ${p.artist_name} — ${p.stage}, ${formatTime(p.start_time)}–${formatTime(p.end_time)}`,
        );
      }
      return lines.join("\n");
    }
  }
  return "Today's not a festival day. The 2026 marquee names: Stevie Nicks, Lorde, Tyler Childers, Sean Paul, Nas, Big Freedia, Pearl Jam, and Jon Batiste — check each day's headliners.";
}

export function handleSubjectiveRecommendation(query: string): { response: string } {
  const q = norm(query);
  const category = detectRecCategory(q);

  // Music subjective queries route to today's headliners.
  if (category === "music") {
    return { response: handleCantMissMusic() };
  }

  // Filter recommendations by category. If we have specific category picks,
  // use them. Otherwise fall back to a random rotation of the full list so
  // the user still gets a real answer.
  let picks: Recommendation[] = category
    ? recommendations.filter((r) => r.categories.includes(category))
    : [];
  let usedFallback = false;
  if (picks.length === 0) {
    picks = recommendations;
    usedFallback = true;
  }

  // Shuffle so repeat asks return varied picks. Cap at 3.
  const top = shuffle(picks).slice(0, 3);

  const headerCategory = category && category !== "must-try" ? category : null;
  const header = headerCategory
    ? `Top picks — ${headerCategory}:`
    : `Top picks:`;
  const lines: string[] = [header, ""];
  for (const r of top) {
    lines.push(...recLine(r));
    lines.push("");
  }
  if (usedFallback && category) {
    lines.push(`No editor pick for "${category}" specifically — these are festival favorites.`);
  }
  return { response: lines.join("\n").trimEnd() };
}

// ---- Surprise me ----

// Vendor names already in the popular-picks list. Excluded from food surprises
// so we surface lesser-known finds instead of repeating the obvious.
const POPULAR_VENDOR_NAMES_LOWER = new Set(
  POPULAR_FOOD_PICKS.map((p) => p.vendorMatch.toLowerCase()),
);

// Stages where "headliners" play. Excluded from music surprises so we
// surface smaller-stage discoveries instead.
const HEADLINER_STAGES_FOR_SURPRISE = new Set([
  "Festival Stage",
  "Shell Gentilly Stage",
  "Congo Square Stage",
]);

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function surpriseFood(): string {
  // Food = real food vendors only. Cooking demos at the Food Heritage Stage
  // are reorganized under "culture" (they're discovery/educational, not
  // someone you can buy a plate from). Excludes the popular picks so we
  // surface lesser-known finds.
  const candidates = vendors.filter(
    (v) =>
      !Array.from(POPULAR_VENDOR_NAMES_LOWER).some((p) =>
        v.vendor_name.toLowerCase().includes(p),
      ),
  );
  const pick = pickRandom(candidates);
  if (!pick) {
    return "No vendor surprises right now — try crawfish bread, crawfish monica, or a mango freeze.";
  }
  return [
    `🍴 Off the beaten path:`,
    ``,
    `${pick.vendor_name}`,
    `${pick.location_description}`,
    `Try: ${pick.food_items.slice(0, 3).join(", ")}`,
  ].join("\n");
}

function surpriseMusic(): string {
  // Prefer something happening NOW or NEXT on a non-headliner stage today.
  const { day, minutes } = getFestivalNow();
  if (day) {
    const liveOffTheBeatenPath = artists
      .filter(
        (a) =>
          a.day === day &&
          !HEADLINER_STAGES_FOR_SURPRISE.has(a.stage) &&
          toMinutes(a.start_time) <= minutes &&
          toMinutes(a.end_time) > minutes &&
          a.stage !== "Food Heritage Stage", // food handled separately
      );
    const upcoming = artists
      .filter(
        (a) =>
          a.day === day &&
          !HEADLINER_STAGES_FOR_SURPRISE.has(a.stage) &&
          toMinutes(a.start_time) > minutes &&
          a.stage !== "Food Heritage Stage",
      )
      .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time))
      .slice(0, 6);
    const pool = liveOffTheBeatenPath.length > 0 ? liveOffTheBeatenPath : upcoming;
    const pick = pickRandom(pool);
    if (pick) {
      const isLive =
        toMinutes(pick.start_time) <= minutes && toMinutes(pick.end_time) > minutes;
      const verb = isLive ? "Playing right now" : "Up next";
      return [
        `🎵 Off the main stage:`,
        ``,
        `${pick.artist_name}`,
        `${verb} · ${formatTime(pick.start_time)}–${formatTime(pick.end_time)}`,
        `${pick.stage}`,
      ].join("\n");
    }
  }
  // Fallback: any non-headliner act.
  const fallback = pickRandom(
    artists.filter(
      (a) =>
        !HEADLINER_STAGES_FOR_SURPRISE.has(a.stage) &&
        a.stage !== "Food Heritage Stage",
    ),
  );
  if (!fallback) return "Wander to a smaller stage — that's where Jazz Fest hides its best secrets.";
  return [
    `🎵 Worth checking out:`,
    ``,
    `${fallback.artist_name}`,
    `${formatRelativeDay(fallback.day as FestivalDay)} · ${formatTime(fallback.start_time)}–${formatTime(fallback.end_time)}`,
    `${fallback.stage}`,
  ].join("\n");
}

function surpriseCulture(): string {
  // Two pools merge here:
  //   (a) Folklife Village + Cultural Exchange Pavilion demos (the demos data)
  //   (b) Food Heritage Stage cooking demos today (educational, not vending)
  // Picked roughly 50/50 when both have content, so the surprise feels varied.
  const { day, minutes } = getFestivalNow();
  const weekend1Days = new Set<string>(["Thu Apr 23", "Fri Apr 24", "Sat Apr 25", "Sun Apr 26"]);
  const activeWeekend: "1" | "2" | null = day
    ? weekend1Days.has(day)
      ? "1"
      : "2"
    : null;
  const culturalDemos = activeWeekend
    ? demos.filter((d) => d.weekend === activeWeekend || d.weekend === "both")
    : demos;

  const heritageToday = day
    ? artists.filter((a) => a.stage === "Food Heritage Stage" && a.day === day)
    : [];
  const heritageUpcoming = heritageToday.filter(
    (a) => toMinutes(a.end_time) >= minutes,
  );
  const heritagePool = heritageUpcoming.length > 0 ? heritageUpcoming : heritageToday;

  const preferHeritage =
    heritagePool.length > 0 &&
    (culturalDemos.length === 0 || Math.random() < 0.5);

  if (preferHeritage) {
    const pick = pickRandom(heritagePool);
    if (pick) {
      const dayLabel = formatRelativeDay(pick.day as FestivalDay);
      return [
        `🎨 Live cooking demo at the Food Heritage Stage:`,
        ``,
        `${pick.artist_name}`,
        `${dayLabel} · ${formatTime(pick.start_time)}–${formatTime(pick.end_time)}`,
        `Food Heritage Stage`,
      ].join("\n");
    }
  }

  const pick = pickRandom(culturalDemos);
  if (!pick) {
    return "Try the Folklife Village or the Cultural Exchange Pavilion — easy to miss, hard to forget.";
  }
  const tag = pick.sub_area ? ` (${pick.sub_area})` : "";
  return [
    `🎨 Discovery worth a detour:`,
    ``,
    `${pick.name}`,
    `${pick.area}${tag}`,
    `${pick.description}`,
  ].join("\n");
}

const SURPRISE_CATEGORY_PROMPT = [
  "Pick your flavor:",
  "• Food",
  "• Music",
  "• Culture",
  "",
  "Reply with one — I'll surface a hidden gem.",
].join("\n");

export function handleSurpriseMe(query: string): {
  response: string;
  pending?: PendingDisambiguation;
} {
  const cat = detectSurpriseCategory(norm(query));
  if (!cat) {
    return {
      response: SURPRISE_CATEGORY_PROMPT,
      pending: { kind: "surprise" },
    };
  }
  if (cat === "food") return { response: surpriseFood() };
  if (cat === "music") return { response: surpriseMusic() };
  return { response: surpriseCulture() };
}

export function handleFoodRecommendations(): string {
  const lines: string[] = ["Must-try Jazz Fest food:"];
  let added = 0;
  for (const pick of POPULAR_FOOD_PICKS) {
    const vendor = vendors.find((v) =>
      v.vendor_name.toLowerCase().includes(pick.vendorMatch.toLowerCase()),
    );
    if (!vendor) continue;
    lines.push(`• ${pick.foodItem} — ${vendor.vendor_name} (${vendor.location_description})`);
    added++;
    if (added >= 4) break;
  }
  if (added === 0) {
    return "Try classics: crawfish bread, crawfish monica, mango freeze, cochon de lait po-boy, beignets.";
  }
  lines.push("");
  lines.push("Want something specific? Try a food name or ingredient.");
  return lines.join("\n");
}

// ---- Disambiguation resolution ----

// When the previous turn offered 2+ day options, resolve a short reply to one.
// Accepts: "23" / "30", "apr 23", "first"/"second", "1"/"2", "last", or a full
// day label like "thu apr 23".
function resolveDayFromReply(reply: string, options: FestivalDay[]): FestivalDay | null {
  const r = norm(reply);
  if (!r) return null;

  // Full label match (e.g. "thu apr 23")
  for (const d of options) {
    if (r.includes(norm(d))) return d;
  }
  // "apr 23" / "may 3" style
  for (const d of options) {
    const parts = d.toLowerCase().split(" "); // e.g. ["thu", "apr", "23"]
    const monthDay = `${parts[1]} ${parts[2]}`; // "apr 23"
    if (r.includes(monthDay)) return d;
  }
  // Ordinals — "first" / "second" / "last"
  if (/\b(first|1st)\b/.test(r)) return options[0];
  if (/\b(second|2nd|last)\b/.test(r) && options.length >= 2) {
    return options[options.length - 1];
  }
  // Bare number: prefer list-index interpretation (1-based).
  // "1" → option #1, "2" → option #2. If the digit is beyond the list size,
  // fall back to day-of-month matching (e.g. "23" → Thu Apr 23).
  const numMatch = r.match(/\b(\d{1,2})\b/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= options.length) return options[n - 1];
    const nStr = numMatch[1];
    for (const d of options) {
      const parts = d.toLowerCase().split(" ");
      if (parts[2] === nStr) return d;
    }
  }
  return null;
}

// ---- Conversational follow-up detection ----
//
// Catches short replies that lean entirely on prior conversation context.
// Examples (with `lastArtist = "Jason Isbell"`):
//   "who is he?"        → bio
//   "what stage?"       → "Shell Gentilly Stage — today, 3:30 PM–4:50 PM."
//   "what time?" / "when?" → time slot
//   "who's after?"      → next on that stage
//   "anything similar?" → genre-similar artists
//
// Uses anchored regex on the FULL trimmed query so longer questions still
// route through normal classification.

const FOLLOWUP_BIO_RE =
  /^(who\s+(is|s)\s+(he|she|they)|who\s+are\s+they|tell\s+me\s+(about|more\s+about)\s+(him|her|them|that(\s+one)?)|more\s+about\s+(him|her|them)|bio|his\s+bio|her\s+bio|their\s+bio)\??$/;

const FOLLOWUP_STAGE_RE =
  /^(what\s+stage|which\s+stage|where|where\s+is\s+(he|she|they|him|her|them|it)|what\s+stage\s+is\s+(he|she|they|it)\s+(on|playing(\s+on)?)|where\s+(does|do)\s+(he|she|they|it)\s+play)\??$/;

const FOLLOWUP_TIME_RE =
  /^(what\s+time|when|when\s+(does|do)\s+(he|she|they|it)\s+play|when\s+(is|are)\s+(he|she|they|it)\s+(on|playing))\??$/;

const FOLLOWUP_NEXT_RE =
  /^(who(\s+is|s)\s+after|what(\s+is|s)\s+next|what(\s+is|s)\s+after|next|who\s+plays\s+after)\??$/;

const FOLLOWUP_PREV_RE =
  /^(who(\s+is|s)\s+before|what(\s+is|s)\s+before|who\s+played\s+before)\??$/;

const FOLLOWUP_SIMILAR_RE =
  /^(anything\s+similar|similar(\s+artists?|\s+bands?)?|more\s+like\s+(this|him|her|them)|any\s+others?\s+like\s+(him|her|them|that)|other\s+(bands?|artists?)\s+like\s+(him|her|them))\??$/;

const FOLLOWUP_ELSE_PLAYING_RE =
  /^(what\s+else\s+is\s+playing|whats\s+else\s+playing|what\s+else|else\s+playing|anything\s+else\s+playing|anything\s+else)\??$/;

const FOLLOWUP_FOOD_INTENT_RE =
  /^(what\s+about\s+food|hows\s+the\s+food|food|how\s+about\s+food|im\s+hungry\s+now|getting\s+hungry)\??$/;

const NO_SUBJECT_FALLBACK =
  "I can, but who are we talking about? Try an artist name like Jason Isbell.";

// Find similar artists by genre-token overlap. Prefer same day or today.
// Excludes the target artist and Food Heritage Stage demos.
export function handleSimilarArtists(
  artistName: string,
  context?: AnswerContext,
): { response: string; resolvedArtist?: string; resolvedStage?: string; resolvedDay?: FestivalDay } {
  void context;
  const target = findArtist(artistName);
  if (!target) {
    return { response: `I lost track of ${artistName}.` };
  }
  const targetGenres = norm(target.genre)
    .split(" ")
    .filter((t) => t.length > 2);
  if (targetGenres.length === 0) {
    return { response: `Not enough genre info on ${target.artist_name} to find similar acts.` };
  }
  const today = getFestivalNow().day;
  const scored = artists
    .filter(
      (a) =>
        a.artist_name !== target.artist_name &&
        a.stage !== "Food Heritage Stage",
    )
    .map((a) => {
      const aGenres = norm(a.genre).split(" ");
      const overlap = targetGenres.filter((g) => aGenres.includes(g)).length;
      const sameDay = a.day === target.day ? 0.7 : 0;
      const todayBoost = today && a.day === today ? 0.4 : 0;
      return { artist: a, score: overlap + sameDay + todayBoost };
    })
    .filter((s) => s.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  if (scored.length === 0) {
    return { response: `Nothing in the data overlaps with ${target.genre}.` };
  }
  const lines = [
    `Similar to ${target.artist_name} (${target.genre}):`,
    "",
  ];
  for (const s of scored) {
    const a = s.artist;
    const dayLabel = formatRelativeDay(a.day as FestivalDay);
    lines.push(
      `• ${a.artist_name} — ${dayLabel}, ${formatTime(a.start_time)}–${formatTime(a.end_time)} on ${a.stage}`,
    );
  }
  return { response: lines.join("\n"), resolvedArtist: target.artist_name };
}

function resolveConversationalFollowUp(
  query: string,
  context?: AnswerContext,
): AnswerResult | null {
  const q = norm(query);
  if (!q) return null;

  // All the patterns below assume prior subject context (lastArtist).
  // Group their handling so the no-subject fallback is consistent.

  if (FOLLOWUP_BIO_RE.test(q)) {
    if (!context?.lastArtist) {
      return { intent: "unknown", response: NO_SUBJECT_FALLBACK };
    }
    const result = handleArtistBio(context.lastArtist);
    return { intent: "artist_bio", ...result };
  }

  if (FOLLOWUP_STAGE_RE.test(q)) {
    if (!context?.lastArtist) {
      return { intent: "unknown", response: NO_SUBJECT_FALLBACK };
    }
    const a = findArtist(context.lastArtist);
    if (!a) return { intent: "unknown", response: "I lost track — who were we talking about?" };
    const dayLabel = formatRelativeDay(a.day as FestivalDay);
    return {
      intent: "artist_lookup",
      response: `${a.stage} — ${dayLabel}, ${formatTime(a.start_time)}–${formatTime(a.end_time)}.`,
      resolvedArtist: a.artist_name,
      resolvedStage: a.stage,
      resolvedDay: a.day as FestivalDay,
    };
  }

  if (FOLLOWUP_TIME_RE.test(q)) {
    if (!context?.lastArtist) {
      return { intent: "unknown", response: NO_SUBJECT_FALLBACK };
    }
    const a = findArtist(context.lastArtist);
    if (!a) return { intent: "unknown", response: "I lost track — who were we talking about?" };
    const dayLabel = formatRelativeDay(a.day as FestivalDay);
    return {
      intent: "artist_lookup",
      response: `${dayLabel}, ${formatTime(a.start_time)}–${formatTime(a.end_time)} on ${a.stage}.`,
      resolvedArtist: a.artist_name,
      resolvedStage: a.stage,
      resolvedDay: a.day as FestivalDay,
    };
  }

  if (FOLLOWUP_NEXT_RE.test(q)) {
    if (!context?.lastArtist) {
      return { intent: "unknown", response: NO_SUBJECT_FALLBACK };
    }
    const result = handleNextOnStage(context.lastArtist, context);
    return { intent: "next_on_stage", ...result };
  }

  if (FOLLOWUP_PREV_RE.test(q)) {
    if (!context?.lastArtist) {
      return { intent: "unknown", response: NO_SUBJECT_FALLBACK };
    }
    const result = handlePrevOnStage(context.lastArtist, context);
    return { intent: "prev_on_stage", ...result };
  }

  if (FOLLOWUP_SIMILAR_RE.test(q)) {
    if (!context?.lastArtist) {
      return { intent: "unknown", response: NO_SUBJECT_FALLBACK };
    }
    const result = handleSimilarArtists(context.lastArtist, context);
    return { intent: "genre_lookup", ...result };
  }

  if (FOLLOWUP_ELSE_PLAYING_RE.test(q)) {
    // No subject required — answer "what else is on right now" generically.
    return { intent: "now_playing", response: handleNowPlaying("") };
  }

  if (FOLLOWUP_FOOD_INTENT_RE.test(q)) {
    return { intent: "food_recommendations", response: handleFoodRecommendations() };
  }

  return null;
}

// Merge the prior context with what this turn resolved. The frontend stores
// the result wholesale as the new conversation memory.
function mergeContext(
  prior: AnswerContext | undefined,
  result: AnswerResult,
): AnswerContext {
  const ctx: AnswerContext = { ...prior };
  if (result.intent !== "unknown") ctx.lastIntent = result.intent;
  if (result.resolvedArtist) ctx.lastArtist = result.resolvedArtist;
  if (result.resolvedStage) ctx.lastStage = result.resolvedStage;
  if (result.resolvedDay) ctx.lastDay = result.resolvedDay;
  if (result.resolvedTime) ctx.lastTime = result.resolvedTime;
  // Pending state — only carry forward when explicitly returned this turn.
  if (result.pending) {
    ctx.pending = result.pending;
  } else {
    delete ctx.pending;
  }
  return ctx;
}

// ---- Follow-up query rewriting ----

// Connectors that flag a short reply as a follow-up ("and Saturday?",
// "how about tomorrow?"). Stripped from the rewritten query so the result
// reads as a natural full question.
const FOLLOWUP_CONNECTOR_RE = /^\s*(and|how about|what about|same|then|also|or)\b\s*/i;

// When the user sends a short follow-up like "and Saturday?" or "tomorrow?"
// after having talked about a specific artist or stage, synthesize a full
// query by carrying the previous subject forward. Re-routed through answer()
// so the normal handlers do the heavy lifting.
//
// Guardrails:
//   - Short queries only (≤ 3 words, or ≤ 6 with a follow-up connector).
//   - Must introduce a concrete day (not just "that day").
//   - Must NOT already name an artist (that's a subject change).
//   - Original query must classify to `unknown` or `day_lookup` — anything
//     more specific already has a good answer on its own.
function maybeRewriteFollowUp(query: string, context?: AnswerContext): string | null {
  if (!context?.lastArtist && !context?.lastStage) return null;

  const q = norm(query);
  const wordCount = q ? q.split(" ").filter(Boolean).length : 0;
  if (wordCount === 0) return null;

  const connectorLead = FOLLOWUP_CONNECTOR_RE.test(query);
  const isShort = wordCount <= 3;
  if (!connectorLead && !isShort) return null;
  if (wordCount > 6) return null;

  // Don't rewrite if the query already names an artist — that's a fresh subject.
  if (findArtist(q)) return null;

  // Only rewrite when the query brings a concrete day reference.
  // Day-pronouns ("that day") are resolved elsewhere via lastDay.
  const hasConcreteDay = findDays(query).length > 0;
  if (!hasConcreteDay) return null;

  // Skip rewrite if the original query already classifies to something
  // specific — only rewrite the low-information cases.
  const baseIntent = classify(query);
  if (baseIntent !== "unknown" && baseIntent !== "day_lookup") return null;

  const stripped = query.replace(FOLLOWUP_CONNECTOR_RE, "").trim();
  if (!stripped) return null;

  // Prefer artist-anchored rewrite (more specific than stage).
  if (context.lastArtist) {
    return `when is ${context.lastArtist} playing ${stripped}`;
  }
  if (context.lastStage) {
    return `who is on ${context.lastStage} ${stripped}`;
  }
  return null;
}

// ---- Top-level route ----

// Public entrypoint. All logic lives in routeAnswer; this wrapper computes
// the merged context once at the very end so recursive routing doesn't
// double-wrap or lose intermediate resolutions.
export function answer(query: string, context?: AnswerContext): AnswerResult {
  const result = routeAnswer(query, context);
  return { ...result, updatedContext: mergeContext(context, result) };
}

function routeAnswer(query: string, context?: AnswerContext): AnswerResult {
  // Voice-to-text and autocorrect cleanup before any matching/classifying.
  // Real-world logs show "tente"/"economy 10"/"playint" are common — bridging
  // them upstream avoids dragging the noise through every downstream rule.
  const cleaned = correctVoiceTypos(query);
  const trimmed = cleaned.trim();
  if (!trimmed) {
    return { intent: "unknown", response: "Ask me about an artist, a stage, a day, a genre, what's on now, or where to find food." };
  }

  // Resolve a pending surprise-category prompt from the previous turn.
  if (context?.pending?.kind === "surprise") {
    const cat = detectSurpriseCategory(norm(trimmed));
    if (cat) {
      const result = handleSurpriseMe(trimmed);
      return { intent: "surprise_me", ...result };
    }
    // Reply doesn't look like a category — clear pending and treat as a
    // fresh query so the user isn't stuck.
  }

  // Resolve a pending day-disambiguation from the previous turn.
  if (context?.pending?.kind === "day") {
    const { pending: _p, ...rest } = context;

    // (1) Exact resolution: reply uniquely identifies one of the options.
    const resolved = resolveDayFromReply(trimmed, context.pending.options);
    if (resolved) {
      const rewritten = `${context.pending.originalQuery} ${resolved}`;
      return routeAnswer(rewritten, rest);
    }

    // (2) Augmented re-run: reply may narrow the options (e.g. "friday" against
    //     8 days narrows to 2 Fridays). Append the reply to the original query
    //     and re-run — this preserves clock-time / stage filters across the
    //     multi-step disambiguation.
    const augmented = `${context.pending.originalQuery} ${trimmed}`;
    const augResult = routeAnswer(augmented, rest);
    if (augResult.intent !== "unknown") return augResult;

    // Neither worked — fall through and treat `trimmed` as a fresh query.
  }

  // CONVERSATIONAL FOLLOW-UPS — terse replies that lean entirely on prior
  // context. "Who is he?", "what stage?", "anything similar?" etc.
  const followUp = resolveConversationalFollowUp(trimmed, context);
  if (followUp) return followUp;

  // Follow-up rewrite: a short reply like "and Saturday?" or "tomorrow?"
  // after we've been talking about an artist/stage is re-expanded into a
  // full question and re-routed. Keeps short-form conversation natural
  // without introducing an LLM.
  const rewritten = maybeRewriteFollowUp(trimmed, context);
  if (rewritten && rewritten !== trimmed) {
    return routeAnswer(rewritten, context);
  }

  const intent = classify(trimmed);
  switch (intent) {
    case "now_playing":
      return { intent, response: handleNowPlaying(trimmed) };
    case "stage_lookup":
      return { intent, ...handleStageLookup(trimmed, context) };
    case "artist_bio":
      return { intent, ...handleArtistBio(trimmed) };
    case "artist_lookup":
      return { intent, ...handleArtistLookup(trimmed) };
    case "food_lookup":
      return { intent, response: handleFoodLookup(trimmed) };
    case "food_recommendations":
      return { intent, response: handleFoodRecommendations() };
    case "surprise_me":
      return { intent, ...handleSurpriseMe(trimmed) };
    case "subjective_recommendation":
      return { intent, ...handleSubjectiveRecommendation(trimmed) };
    case "day_lookup":
      return { intent, ...handleDayLookup(trimmed, context) };
    case "next_on_stage":
      return { intent, ...handleNextOnStage(trimmed, context) };
    case "prev_on_stage":
      return { intent, ...handlePrevOnStage(trimmed, context) };
    case "genre_lookup":
      return { intent, ...handleGenreLookup(trimmed) };
    case "time_window":
      return { intent, ...handleTimeWindow(trimmed) };
    case "conflict_lookup":
      return { intent, ...handleConflictLookup(trimmed, context) };
    case "cultural_lookup":
      return { intent, ...handleCulturalLookup(trimmed) };
    case "faq_lookup":
      return { intent, response: handleFaqLookup(trimmed) };
    case "headliner_lookup":
      return { intent, ...handleHeadlinerLookup(trimmed) };
    default: {
      // Last-chance: maybe a fuzzy artist guess salvages the query.
      const guess = findClosestArtistGuess(trimmed);
      if (guess) {
        return {
          intent: "unknown",
          response: `I didn't catch that — did you mean ${guess.artist_name}?`,
        };
      }
      return {
        intent: "unknown",
        response: "I'm not finding that one. Try an artist name, stage name, or food item.",
      };
    }
  }
}
