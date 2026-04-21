#!/usr/bin/env python3
"""Parse the Jazz Fest Cubes bbox-layout XHTML into structured schedule rows.

Strategy per page (one page = one day):
1. Find day title from top-of-page words.
2. Identify the stage-header band (the row of stage names near the top).
3. Cluster header words vertically by yMin, then group horizontally into columns.
   Each cluster of words in the header band represents one stage.
4. For the body of the page, assign every word to the nearest column by xCenter.
5. Within each column, split time tokens from name tokens. The time tokens divide
   the column into cubes. Each cube's start_time = top time, end_time = the next
   time below it (or None if it's the last).
6. Emit rows: {day, stage, start_time, end_time, artist_name}.

This keeps us honest: if a cube has no time below it, end_time is None and we
flag it so a human can verify.
"""

import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET

NS_HTML = {"x": "http://www.w3.org/1999/xhtml"}

# Matches Cubes-style time cells. The PDF uses "am"/"pm" lowercase.
TIME_RE = re.compile(r"^\d{1,2}:\d{2}$")
AMPM_RE = re.compile(r"^(am|pm)$", re.IGNORECASE)
# Some cells have the combined form "4:30pm" with no space.
TIME_COMBINED_RE = re.compile(r"^(\d{1,2}):(\d{2})(am|pm)$", re.IGNORECASE)

# Anything below this y on the page is the PARADES / FOLKLIFE / POW WOW footer.
# The real schedule grid ends around y=540 on every page.
BODY_Y_MAX = 548

# We consider a word a "time fragment" if it's a bare time (11:20), am/pm,
# or the combined "4:30pm" form.
def is_time_fragment(word):
    return bool(TIME_RE.match(word) or AMPM_RE.match(word) or TIME_COMBINED_RE.match(word))


def load_pages(xhtml_path):
    raw = Path(xhtml_path).read_text()
    # Strip the DOCTYPE and namespaces to make parsing simpler.
    raw = re.sub(r"<!DOCTYPE[^>]*>", "", raw)
    raw = raw.replace('xmlns="http://www.w3.org/1999/xhtml"', "")
    root = ET.fromstring(raw)
    pages = []
    for page in root.iter("page"):
        words = []
        for w in page.iter("word"):
            text = (w.text or "").strip()
            if not text:
                continue
            try:
                x0 = float(w.attrib["xMin"])
                x1 = float(w.attrib["xMax"])
                y0 = float(w.attrib["yMin"])
                y1 = float(w.attrib["yMax"])
            except (KeyError, ValueError):
                continue
            words.append({
                "text": text,
                "x0": x0, "x1": x1, "y0": y0, "y1": y1,
                "xc": (x0 + x1) / 2,
                "yc": (y0 + y1) / 2,
            })
        if words:
            pages.append(words)
    return pages


def find_day(words):
    # The day header is the largest-Y-range text at the very top of the page.
    # We pick the topmost block and stitch its words.
    top = [w for w in words if w["y0"] < 70]
    if not top:
        return None
    top = sorted(top, key=lambda w: (w["y0"], w["x0"]))
    phrase = " ".join(w["text"] for w in top)
    # Expect something like "Thursday, April 23, 2026"
    m = re.search(r"(Thursday|Friday|Saturday|Sunday),\s+(April|May)\s+(\d{1,2}),?\s+2026", phrase)
    if not m:
        return None
    weekday = m.group(1)
    month = m.group(2)
    day = int(m.group(3))
    return {"weekday": weekday, "month": month, "day": day, "label": f"{weekday[:3]} {month[:3]} {day}"}


def group_columns(header_words, tolerance=30):
    """Given header-band words, cluster them by xCenter into stage columns,
    then stitch multi-line stage names within each column."""
    if not header_words:
        return []
    # Sort by xCenter
    words = sorted(header_words, key=lambda w: w["xc"])
    clusters = []  # each: {x_min, x_max, words: []}
    for w in words:
        placed = False
        for c in clusters:
            if abs(w["xc"] - c["xc"]) <= tolerance:
                c["words"].append(w)
                c["xc"] = sum(x["xc"] for x in c["words"]) / len(c["words"])
                c["x_min"] = min(c["x_min"], w["x0"])
                c["x_max"] = max(c["x_max"], w["x1"])
                placed = True
                break
        if not placed:
            clusters.append({
                "xc": w["xc"],
                "x_min": w["x0"],
                "x_max": w["x1"],
                "words": [w],
            })
    # Build the column name by concatenating words sorted by (y, x)
    columns = []
    for c in clusters:
        lines = defaultdict(list)
        for w in c["words"]:
            # bucket by y within 5pt to group into lines
            key = round(w["y0"] / 4) * 4
            lines[key].append(w)
        ordered_lines = sorted(lines.items(), key=lambda kv: kv[0])
        name_parts = []
        for _, line_words in ordered_lines:
            line_sorted = sorted(line_words, key=lambda w: w["x0"])
            name_parts.append(" ".join(w["text"] for w in line_sorted))
        columns.append({
            "name": " ".join(name_parts).strip(),
            "xc": c["xc"],
            "x_min": c["x_min"],
            "x_max": c["x_max"],
        })
    columns.sort(key=lambda c: c["xc"])
    return columns


def identify_header_band(words, day_info):
    """Stage names live between the day title and the first schedule time.
    Find the y of the earliest time token; header band = words above that minus
    the day title."""
    times = [w for w in words if is_time_fragment(w["text"])]
    if not times:
        return []
    earliest_time_y = min(t["y0"] for t in times)
    # Day title is within ~70 px from top. Header band is below the title up to
    # the first time.
    return [w for w in words if 70 <= w["y0"] < earliest_time_y - 2]


def assign_column(word, columns):
    """Return the column whose xCenter is closest to the word's xCenter,
    but only if the word is plausibly within the column's horizontal span."""
    best = None
    best_dist = 1e9
    for c in columns:
        d = abs(word["xc"] - c["xc"])
        if d < best_dist:
            best_dist = d
            best = c
    return best


def parse_times_in_column(col_words):
    """Merge adjacent time fragments like ['11:20', 'am'] into one time string
    at the yCenter of the numeric part. Return list of dicts: {yc, time}."""
    # Sort by y, then x.
    words = sorted(col_words, key=lambda w: (w["y0"], w["x0"]))
    times = []
    i = 0
    while i < len(words):
        w = words[i]
        # Combined form "4:30pm"
        m_comb = TIME_COMBINED_RE.match(w["text"])
        if m_comb:
            times.append({"yc": w["yc"], "time": f"{m_comb.group(1)}:{m_comb.group(2)} {m_comb.group(3).lower()}"})
            i += 1
            continue
        if TIME_RE.match(w["text"]):
            t_text = w["text"]
            t_yc = w["yc"]
            # Look ahead for am/pm near same y
            j = i + 1
            ampm = None
            while j < len(words):
                nxt = words[j]
                if abs(nxt["yc"] - w["yc"]) <= 5 and AMPM_RE.match(nxt["text"]):
                    ampm = nxt["text"].lower()
                    j += 1
                    break
                if nxt["y0"] > w["y1"] + 1:
                    break
                j += 1
            if ampm:
                times.append({"yc": t_yc, "time": f"{t_text} {ampm}"})
                i = j
                continue
        i += 1
    return times


def to_24h(t):
    """'5:20 pm' -> '17:20'. Returns None on parse failure."""
    m = re.match(r"^(\d{1,2}):(\d{2})\s+(am|pm)$", t.strip().lower())
    if not m:
        return None
    h = int(m.group(1)); mm = int(m.group(2)); ampm = m.group(3)
    if ampm == "pm" and h < 12: h += 12
    if ampm == "am" and h == 12: h = 0
    return f"{h:02d}:{mm:02d}"


def build_cubes(columns, body_words):
    """For each column, walk down by y. A cube = (start_time, end_time, artist_name)."""
    # Bucket body words by column.
    col_words = {c["name"]: [] for c in columns}
    col_times = {c["name"]: [] for c in columns}
    col_nontime = {c["name"]: [] for c in columns}

    # Precompute left/right halfway boundaries between adjacent columns so a word
    # is only assigned to a column if it lies within [left_bound, right_bound).
    centers = [c["xc"] for c in columns]
    bounds = []
    for i, c in enumerate(columns):
        left = -1e9 if i == 0 else (centers[i-1] + centers[i]) / 2
        right = 1e9 if i == len(columns) - 1 else (centers[i] + centers[i+1]) / 2
        bounds.append((left, right))

    for w in body_words:
        for i, c in enumerate(columns):
            left, right = bounds[i]
            if left <= w["xc"] < right:
                col_words[c["name"]].append(w)
                if is_time_fragment(w["text"]):
                    col_times[c["name"]].append(w)
                else:
                    col_nontime[c["name"]].append(w)
                break

    all_cubes = []
    for c in columns:
        stage = c["name"]
        times = parse_times_in_column(col_times[stage])
        # Sort times by y
        times.sort(key=lambda t: t["yc"])
        # Group non-time words into lines by y (group within 6 pt of each other).
        nontime = sorted(col_nontime[stage], key=lambda w: (w["y0"], w["x0"]))
        # Build "lines" of text (grouped by similar y)
        lines = []
        for w in nontime:
            if lines and abs(w["yc"] - lines[-1]["yc"]) <= 6:
                lines[-1]["words"].append(w)
                ys = [x["yc"] for x in lines[-1]["words"]]
                lines[-1]["yc"] = sum(ys) / len(ys)
            else:
                lines.append({"yc": w["yc"], "words": [w]})
        # Stitch each line's words into a string sorted by x.
        line_strs = []
        for l in lines:
            l["words"].sort(key=lambda w: w["x0"])
            text = " ".join(w["text"] for w in l["words"]).strip()
            if text:
                line_strs.append({"yc": l["yc"], "text": text})

        # Walk down times: each cube gets the lines between this time's yc and the next time's yc.
        for i, t in enumerate(times):
            y_top = t["yc"]
            y_bot = times[i+1]["yc"] if i + 1 < len(times) else 1e9
            cube_lines = [l["text"] for l in line_strs if y_top - 2 <= l["yc"] < y_bot - 2]
            artist_text = " ".join(cube_lines).strip()
            if not artist_text:
                continue
            start_time = to_24h(t["time"])
            end_time = to_24h(times[i+1]["time"]) if i + 1 < len(times) else None
            all_cubes.append({
                "stage": stage,
                "start_time": start_time,
                "end_time": end_time,
                "artist_name": artist_text,
                "start_raw": t["time"],
                "end_raw": times[i+1]["time"] if i + 1 < len(times) else None,
            })
    return all_cubes


def main(xhtml_path):
    pages = load_pages(xhtml_path)
    all_rows = []
    warnings = []
    for page_idx, words in enumerate(pages, start=1):
        day_info = find_day(words)
        if not day_info:
            warnings.append(f"page {page_idx}: could not find day header")
            continue
        header_band = identify_header_band(words, day_info)
        columns = group_columns(header_band)
        earliest_time_y = min((t["y0"] for t in words if is_time_fragment(t["text"])), default=0)
        body_words = [
            w for w in words
            if w["y0"] >= earliest_time_y - 2
            and w["y0"] < BODY_Y_MAX
        ]
        cubes = build_cubes(columns, body_words)
        for c in cubes:
            all_rows.append({
                "day": day_info["label"],
                **c,
            })
    return {"rows": all_rows, "warnings": warnings}


def add_minutes(hhmm, mins):
    h, m = hhmm.split(":")
    total = int(h) * 60 + int(m) + mins
    return f"{total // 60 % 24:02d}:{total % 60:02d}"


def postprocess(rows):
    """Clean up edge cases:
    - Missing end_time -> start_time + 60 min (last cube in a column).
    - Trim redundant whitespace in artist names.
    - Drop empty / placeholder rows.
    """
    out = []
    for r in rows:
        name = re.sub(r"\s+", " ", r["artist_name"]).strip()
        # Drop footer leakage
        if not name:
            continue
        if re.search(r"\b(PARADES|FOLKLIFE|POW WOW)\b", name, re.I):
            continue
        start = r["start_time"]
        end = r["end_time"] or add_minutes(start, 60)
        out.append({
            "day": r["day"],
            "stage": r["stage"],
            "start_time": start,
            "end_time": end,
            "artist_name": name,
        })
    # Sort: day order, then stage, then start
    DAY_ORDER = ["Thu Apr 23", "Fri Apr 24", "Sat Apr 25", "Sun Apr 26",
                 "Thu Apr 30", "Fri May 1", "Sat May 2", "Sun May 3"]
    def key(r):
        return (DAY_ORDER.index(r["day"]) if r["day"] in DAY_ORDER else 99,
                r["stage"], r["start_time"])
    out.sort(key=key)
    return out


if __name__ == "__main__":
    out = main("/tmp/cubes.html")
    out["rows"] = postprocess(out["rows"])
    print(json.dumps(out, indent=2))
