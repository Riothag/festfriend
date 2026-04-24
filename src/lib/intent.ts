import { artists as scheduleArtists } from "@/data/artists";
import { foodHeritageDemos } from "@/data/food_heritage";
import { stages } from "@/data/stages";
import { vendors } from "@/data/vendors";
import { festivalDays, festivalTimezone } from "@/data/festival";
import { demos } from "@/data/cultural_programs";
import { faqs } from "@/data/faqs";

// Music schedule + cooking demos merged. Both conform to the Artist shape.
const artists = [...scheduleArtists, ...foodHeritageDemos];
import { formatTime, getFestivalNow, toMinutes } from "@/lib/time";
import type { AnswerContext, AnswerResult, Artist, Demo, FAQ, FestivalDay, Intent, PendingDisambiguation, Stage, Vendor } from "@/types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

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
  if (qt.length < 4 || at.length < 4) return false;
  // Require the first character to agree. Most typos preserve the leading
  // letter, and this rejects coincidental overlaps like "main" / "pain".
  if (qt[0] !== at[0]) return false;
  if (Math.abs(qt.length - at.length) > 2) return false;
  const longer = Math.max(qt.length, at.length);
  const budget = longer >= 7 ? 2 : 1;
  return editDistance(qt, at) <= budget;
}

// ---- Lookups ----

// Words that look like they could match an artist name via substring but are
// really day/time indicators. Bare queries of these words should NOT resolve
// to an artist (e.g. "friday" shouldn't match "Kevin Louis & The Friday Night
// Jazz Band"). They still match when embedded in a longer query that
// legitimately contains an artist name.
const BARE_NON_ARTIST_WORDS = new Set([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "mon", "tues", "wed", "thu", "thur", "thurs", "fri", "sat", "sun",
  "today", "tomorrow", "tonight", "yesterday",
  "apr", "april", "may",
  "first", "second", "last",
  "morning", "afternoon", "evening", "night",
  "weekend",
]);

function scoreArtists(query: string): { artist: Artist; score: number }[] {
  const q = norm(query);
  if (!q) return [];
  // Reject bare day/time words up front — they'd substring-match too loosely.
  if (BARE_NON_ARTIST_WORDS.has(q)) return [];
  // Exact
  const exact = artists.filter((a) => norm(a.artist_name) === q).map((a) => ({ artist: a, score: 100 }));
  if (exact.length > 0) return exact;
  // Substring (full query inside name, or short name inside query)
  const substring = artists
    .filter((a) => {
      const name = norm(a.artist_name);
      return name.includes(q) || (q.length >= 4 && q.includes(name));
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
    // Fuzzy fallback. Require ALL of the artist's tokens to be matched by
    // some query token — otherwise "main" fuzzy-matching "pain" would pull
    // in T-Pain from a query like "main act on the main stage". For
    // single-token artists, additionally require a short query so we don't
    // grab artists out of long unrelated sentences.
    const matchedArtistTokens = aTokens.filter((at) =>
      qTokens.some((qt) => fuzzyTokenMatch(qt, at)),
    ).length;
    if (matchedArtistTokens === aTokens.length) {
      if (aTokens.length >= 2) {
        scored.push({ artist: a, score: matchedArtistTokens });
      } else if (qTokens.length <= 2) {
        scored.push({ artist: a, score: 1 });
      }
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

  const qTokens = tokens(q);

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
        const foodTokens = words.filter((t) => t.length > 2 && !GENERIC_FOOD_TOKENS.has(t));
        const overlap = qTokens.filter((t) => foodTokens.includes(t)).length;
        if (overlap >= 2) {
          score = Math.max(score, 85);
        } else if (overlap === 1 && qTokens.length <= 2 && foodTokens.length >= 1) {
          // Narrow query ("oysters", "gyro", "pie") matching the head noun of
          // a multi-word food item ("Charbroiled Oysters", "Gyro Sandwich",
          // "Apple Pie"). Mild but real signal — multiple vendors can tie here
          // and the user gets a list.
          score = Math.max(score, 65);
        }
      } else {
        // Single-word food item — only counts if it's non-generic.
        if (!GENERIC_FOOD_TOKENS.has(nf) && hasWord(nf)) {
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

  // 12. FOOD
  if (NORMED_FOOD.some((p) => q.includes(p))) return "food_lookup";

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

function noArtistFound(query: string) {
  return `I can't find that artist. Try a full name like "Trombone Shorty" or "Stevie Nicks". Your query: "${query}".`;
}

function disambiguationLine(a: Artist) {
  return `• ${a.artist_name} — ${a.day}, ${formatTime(a.start_time)}–${formatTime(a.end_time)} on ${a.stage}`;
}

function maybeDisambiguate(query: string): { response: string; resolvedArtist?: string } | null {
  const matches = findArtists(query);
  if (matches.length <= 1) return null;
  return {
    response: [
      `${matches.length} matches for "${query}". Which one?`,
      ...matches.map(disambiguationLine),
    ].join("\n"),
  };
}

export function handleArtistLookup(query: string): { response: string; resolvedArtist?: string } {
  const dis = maybeDisambiguate(query);
  if (dis) return dis;
  const a = findArtist(query);
  if (!a) return { response: noArtistFound(query) };
  return {
    response: [`${a.artist_name}`, `${a.day} · ${formatTime(a.start_time)}–${formatTime(a.end_time)}`, `${a.stage}`].join("\n"),
    resolvedArtist: a.artist_name,
  };
}

export function handleArtistBio(query: string): { response: string; resolvedArtist?: string } {
  const dis = maybeDisambiguate(query);
  if (dis) return dis;
  const a = findArtist(query);
  if (!a) return { response: noArtistFound(query) };
  return {
    response: [
      `${a.artist_name} (${a.genre})`,
      "",
      a.bio,
      "",
      `Playing ${a.day}, ${formatTime(a.start_time)}–${formatTime(a.end_time)} on ${a.stage}.`,
    ].join("\n"),
    resolvedArtist: a.artist_name,
  };
}

export function handleStageLookup(query: string): { response: string; pending?: PendingDisambiguation } {
  const s = findStage(query);
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
    return { response: `${s.stage_name}${dayContext}\nNo sets in the current data.` };
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
    };
  }
  return {
    response: [
      `${s.stage_name}${dayContext}`,
      s.description,
      "",
      ...sets.map((a) => artistLineCompact(a, { hideStage: true })),
    ].join("\n"),
  };
}

export function handleNowPlaying(query: string = ""): string {
  const { day, minutes } = getFestivalNow();
  if (!day) {
    return "Nothing playing right now — not a festival day. Try \"who's on Festival Stage\" or \"any funk on Saturday\".";
  }
  const stage = findStage(query);
  const onStage = (a: Artist) => !stage || a.stage === stage.stage_name;
  const label = stage ? `${stage.stage_name} now` : `Playing now (${day})`;

  const live = artists.filter(
    (a) =>
      a.day === day &&
      toMinutes(a.start_time) <= minutes &&
      toMinutes(a.end_time) > minutes &&
      onStage(a),
  );
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

function resolveArtist(query: string, context?: AnswerContext): Artist | null {
  const direct = findArtist(query);
  if (direct) return direct;
  if (hasPronoun(query) && context?.lastArtist) return findArtist(context.lastArtist);
  return null;
}

export function handleNextOnStage(query: string, context?: AnswerContext): { response: string; resolvedArtist?: string } {
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
    };
  }
  return {
    response: [
      `After ${target.artist_name} on ${target.stage} (${target.day}):`,
      `${next.artist_name} — ${formatTime(next.start_time)}–${formatTime(next.end_time)}`,
    ].join("\n"),
    resolvedArtist: next.artist_name,
  };
}

export function handlePrevOnStage(query: string, context?: AnswerContext): { response: string; resolvedArtist?: string } {
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
    };
  }
  return {
    response: [
      `Before ${target.artist_name} on ${target.stage} (${target.day}):`,
      `${prev.artist_name} — ${formatTime(prev.start_time)}–${formatTime(prev.end_time)}`,
    ].join("\n"),
    resolvedArtist: prev.artist_name,
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

export function handleDayLookup(query: string): { response: string; pending?: PendingDisambiguation } {
  const days = findDays(query);
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
  if (sets.length === 0) return { response: `No sets listed for ${day}.` };
  return {
    response: [`${day} lineup:`, ...sets.map((a) => `• ${formatTime(a.start_time)} — ${a.artist_name} (${a.stage})`)].join("\n"),
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
  if (sets.length === 0) return { response: `${label} on ${targetDay}: nothing in the data.` };
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

// ---- Top-level route ----

export function answer(query: string, context?: AnswerContext): AnswerResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return { intent: "unknown", response: "Ask me about an artist, a stage, a day, a genre, what's on now, or where to find food." };
  }

  // Resolve a pending day-disambiguation from the previous turn.
  if (context?.pending?.kind === "day") {
    const { pending: _p, ...rest } = context;

    // (1) Exact resolution: reply uniquely identifies one of the options.
    const resolved = resolveDayFromReply(trimmed, context.pending.options);
    if (resolved) {
      const rewritten = `${context.pending.originalQuery} ${resolved}`;
      return answer(rewritten, rest);
    }

    // (2) Augmented re-run: reply may narrow the options (e.g. "friday" against
    //     8 days narrows to 2 Fridays). Append the reply to the original query
    //     and re-run — this preserves clock-time / stage filters across the
    //     multi-step disambiguation.
    const augmented = `${context.pending.originalQuery} ${trimmed}`;
    const augResult = answer(augmented, rest);
    if (augResult.intent !== "unknown") return augResult;

    // Neither worked — fall through and treat `trimmed` as a fresh query.
  }

  const intent = classify(trimmed);
  switch (intent) {
    case "now_playing":
      return { intent, response: handleNowPlaying(trimmed) };
    case "stage_lookup":
      return { intent, ...handleStageLookup(trimmed) };
    case "artist_bio":
      return { intent, ...handleArtistBio(trimmed) };
    case "artist_lookup":
      return { intent, ...handleArtistLookup(trimmed) };
    case "food_lookup":
      return { intent, response: handleFoodLookup(trimmed) };
    case "day_lookup":
      return { intent, ...handleDayLookup(trimmed) };
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
    default:
      return {
        intent: "unknown",
        response: [
          "Not sure what you're asking. Try:",
          "• \"What time does Trombone Shorty play?\"",
          "• \"Who's playing on Festival Stage Sunday?\"",
          "• \"Any funk on Saturday?\"",
          "• \"What's on at 5pm Saturday?\"",
          "• \"What overlaps with Stevie Nicks?\"",
          "• \"Who's after Lorde?\"",
          "• \"Where is crawfish bread?\"",
          "• \"Tell me about Rod Stewart\"",
        ].join("\n"),
      };
  }
}
