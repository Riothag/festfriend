#!/usr/bin/env python3
"""Generate src/data/artists.ts, stages.ts, festival.ts from parsed Cubes JSON.
Vendors are kept separately and imported from the existing CSV.
"""
import csv
import json
import re
from pathlib import Path

DATA = Path("/Users/llacour/Documents/Claude/Projects/FestFriend/src/data")
ROOT = Path("/Users/llacour/Documents/Claude/Projects/FestFriend")

# ---- Load parsed cubes ----
rows = json.load(open("/tmp/cubes.json"))["rows"]

# ---- Canonicalize stage names ----
# The Cubes PDF uses "Gospel Tent presented by Morris Bart". Strip the sponsor
# tagline for display purposes; keep full sponsor names where they're useful
# branding (Shell Gentilly, Sheraton Fais Do-Do, Sandals Cultural Exchange).
STAGE_RENAME = {
    "Gospel Tent presented by Morris Bart": "Gospel Tent",
}
for r in rows:
    r["stage"] = STAGE_RENAME.get(r["stage"], r["stage"])

STAGE_DESCRIPTIONS = {
    "Festival Stage": "Largest outdoor stage at the Fair Grounds infield. Headliners.",
    "Shell Gentilly Stage": "Outdoor main stage. Rock, funk, jam.",
    "Congo Square Stage": "Outdoor stage. African diaspora, hip-hop, R&B, global sounds.",
    "Sheraton New Orleans Fais Do-Do Stage": "Outdoor stage. Cajun, Zydeco, and Louisiana roots.",
    "Jazz & Heritage Stage": "Outdoor stage. Brass bands, second-line, Mardi Gras Indians.",
    "Blues Tent": "Covered tent. Blues and blues-rock.",
    "Gospel Tent": "Covered tent. Gospel and spiritual music. (Presented by Morris Bart.)",
    "Economy Hall Tent": "Covered tent. Trad jazz and brass bands.",
    "WWOZ Jazz Tent": "Covered tent. Modern and contemporary jazz.",
    "Lagniappe Stage": "Smaller outdoor stage. Eclectic, singer-songwriter, world.",
    "Sandals Resorts Jamaica Cultural Exchange Pavilion": "Featured-country pavilion. 2026 spotlight: Jamaica.",
    "Allison Miner Music Heritage Stage": "Interview stage. Conversations with festival artists.",
    "Rhythmpourium Tent": "Reggae, Caribbean, and percussion showcase.",
    "Ochsner Children's Tent": "Family programming and kids performers.",
    # Not in the Cubes PDF; manually added so stage_lookup surfaces them.
    "Food Heritage Stage": "Cooking demonstrations from New Orleans chefs. Four 1-hour demos daily, 11:30 AM–3:30 PM.",
}

# Stages that exist at the festival but aren't in the music Cubes schedule.
# Merged into the generated stages list so lookups work.
EXTRA_STAGES = ["Food Heritage Stage"]

stages = sorted(set({r["stage"] for r in rows}) | set(EXTRA_STAGES))
print("Stages:", len(stages))
for s in stages:
    if s not in STAGE_DESCRIPTIONS:
        print(f"  MISSING DESCRIPTION: {s}")

# ---- Build festival days ----
DAY_LABELS = ["Thu Apr 23", "Fri Apr 24", "Sat Apr 25", "Sun Apr 26",
              "Thu Apr 30", "Fri May 1", "Sat May 2", "Sun May 3"]
DAY_DATES = {
    "Thu Apr 23": "2026-04-23",
    "Fri Apr 24": "2026-04-24",
    "Sat Apr 25": "2026-04-25",
    "Sun Apr 26": "2026-04-26",
    "Thu Apr 30": "2026-04-30",
    "Fri May 1":  "2026-05-01",
    "Sat May 2":  "2026-05-02",
    "Sun May 3":  "2026-05-03",
}

# ---- TS output helpers ----
def ts_string(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'

# ---- Write types/index.ts update (just the FestivalDay union) ----
TYPES_PATH = ROOT / "src" / "types" / "index.ts"
types_src = TYPES_PATH.read_text()
new_union = "export type FestivalDay =\n" + "\n".join(
    f'  | "{d}"' for d in DAY_LABELS
) + ";"
types_src = re.sub(
    r"export type FestivalDay =[\s\S]*?;",
    new_union,
    types_src,
    count=1,
)
TYPES_PATH.write_text(types_src)
print("Updated", TYPES_PATH)

# ---- Write src/data/festival.ts ----
festival_ts = 'import type { FestivalDay } from "@/types";\n\n'
festival_ts += '// Jazz Fest 2026 — two weekends. Thu Apr 23 – Sun May 3.\n'
festival_ts += '// Order matters for "today" detection.\n'
festival_ts += 'export const festivalDays: { day: FestivalDay; date: string }[] = [\n'
for d in DAY_LABELS:
    festival_ts += f'  {{ day: "{d}", date: "{DAY_DATES[d]}" }},\n'
festival_ts += '];\n\n'
festival_ts += 'export const festivalTimezone = "America/Chicago";\n'
(DATA / "festival.ts").write_text(festival_ts)
print("Wrote", DATA / "festival.ts")

# ---- Write src/data/stages.ts ----
stages_ts = 'import type { Stage } from "@/types";\n\n'
stages_ts += '// Jazz Fest 2026 canonical stages — generated from the official Cubes PDF.\n'
stages_ts += '// SWAP REAL DATA HERE — keep the shape.\n'
stages_ts += 'export const stages: Stage[] = [\n'
# Put headline stages first for cleaner disambiguation lists
ORDER = [
    "Festival Stage", "Shell Gentilly Stage", "Congo Square Stage",
    "Sheraton New Orleans Fais Do-Do Stage", "Jazz & Heritage Stage",
    "Blues Tent", "Gospel Tent", "Economy Hall Tent", "WWOZ Jazz Tent",
    "Lagniappe Stage", "Sandals Resorts Jamaica Cultural Exchange Pavilion",
    "Allison Miner Music Heritage Stage", "Rhythmpourium Tent",
    "Ochsner Children's Tent",
]
ordered_stages = [s for s in ORDER if s in stages] + [s for s in stages if s not in ORDER]
for s in ordered_stages:
    desc = STAGE_DESCRIPTIONS.get(s, "")
    stages_ts += f'  {{\n    stage_name: {ts_string(s)},\n    description: {ts_string(desc)},\n  }},\n'
stages_ts += '];\n'
(DATA / "stages.ts").write_text(stages_ts)
print("Wrote", DATA / "stages.ts")

# ---- Write src/data/artists.ts ----
# We don't have bios or genres from the PDF. Use the CSV as a best-effort secondary
# source for bio/genre by artist name match; fall back to "" / "Festival act".
CSV_PATH = ROOT / "data" / "artists.csv"
csv_by_name = {}
with open(CSV_PATH) as f:
    reader = csv.DictReader(f)
    for row in reader:
        name = row["artist_name"].strip()
        csv_by_name[name] = {
            "bio": (row.get("bio") or "").strip(),
            "genre": (row.get("genre") or "").strip(),
        }

def bio_genre_for(name):
    # Direct match
    if name in csv_by_name:
        return csv_by_name[name]
    # Case-insensitive match
    lower = {k.lower(): v for k, v in csv_by_name.items()}
    if name.lower() in lower:
        return lower[name.lower()]
    # Substring match (either direction), prefer longer name overlap
    matches = []
    nl = name.lower()
    for k, v in csv_by_name.items():
        kl = k.lower()
        if kl in nl or nl in kl:
            matches.append((min(len(kl), len(nl)), v))
    if matches:
        matches.sort(reverse=True)
        return matches[0][1]
    return {"bio": "", "genre": ""}

artists_ts = 'import type { Artist } from "@/types";\n\n'
artists_ts += '// Jazz Fest 2026 schedule — generated from the official Cubes PDF.\n'
artists_ts += '// 648 sets across 8 days x 14 stages.\n'
artists_ts += '// SWAP REAL DATA HERE — keep the shape. Times are festival-local (America/Chicago).\n'
artists_ts += 'export const artists: Artist[] = [\n'
for r in rows:
    extra = bio_genre_for(r["artist_name"])
    bio = extra["bio"] or ""
    genre = extra["genre"] or ""
    artists_ts += '  {\n'
    artists_ts += f'    artist_name: {ts_string(r["artist_name"])},\n'
    artists_ts += f'    stage: {ts_string(r["stage"])},\n'
    artists_ts += f'    day: {ts_string(r["day"])},\n'
    artists_ts += f'    start_time: {ts_string(r["start_time"])},\n'
    artists_ts += f'    end_time: {ts_string(r["end_time"])},\n'
    artists_ts += f'    bio: {ts_string(bio)},\n'
    artists_ts += f'    genre: {ts_string(genre)},\n'
    artists_ts += '  },\n'
artists_ts += '];\n'
(DATA / "artists.ts").write_text(artists_ts)
print("Wrote", DATA / "artists.ts", "—", len(rows), "rows")

# ---- Write src/data/vendors.ts from the vendors.csv ----
VENDORS_CSV = ROOT / "data" / "vendors.csv"
vendors = []
with open(VENDORS_CSV) as f:
    reader = csv.DictReader(f)
    for row in reader:
        foods = [f.strip() for f in (row.get("food_items") or "").split(",") if f.strip()]
        vendors.append({
            "vendor_name": row["vendor_name"].strip(),
            "location_description": row["location_description"].strip(),
            "food_items": foods,
            "category": row["category"].strip(),
        })

vendors_ts = 'import type { Vendor } from "@/types";\n\n'
vendors_ts += '// Jazz Fest 2026 vendors — generated from data/vendors.csv.\n'
vendors_ts += '// SWAP REAL DATA HERE — keep the shape.\n'
vendors_ts += 'export const vendors: Vendor[] = [\n'
for v in vendors:
    vendors_ts += '  {\n'
    vendors_ts += f'    vendor_name: {ts_string(v["vendor_name"])},\n'
    vendors_ts += f'    location_description: {ts_string(v["location_description"])},\n'
    vendors_ts += f'    food_items: [{", ".join(ts_string(x) for x in v["food_items"])}],\n'
    vendors_ts += f'    category: {ts_string(v["category"])},\n'
    vendors_ts += '  },\n'
vendors_ts += '];\n'
(DATA / "vendors.ts").write_text(vendors_ts)
print("Wrote", DATA / "vendors.ts", "—", len(vendors), "vendors")
