#!/usr/bin/env python3
"""
Build one flat CSV dataset from a /train training-batch JSONL and its
corresponding results.json (from check_batch.py / reparse_errors.py), then
run a few quick exploration checks against it.

This is explicitly a first look, not a fitted model or a polished report —
with only a handful of entries, it's meant to surface obvious trends (or the
lack of them) and flag rows/splits that need a second look before anyone
tries to draw real conclusions from this data.

Usage:
    python merge_and_explore.py <training-batch.jsonl> <results.json> [--output training_dataset.csv]

Most fields (screen_type, has_label, has_logos, has_qr_code, image_count,
series_name, listening_credit) are top-level fields on each JSONL line
already. Title/subtitle/subtitle2/presenters/background_color/text_color are
NOT — they only exist inside the prompt text sent to the model, under a
"Known ground-truth values:" bullet list, so this script re-parses that
list back into fields.

Each attached image's position/crop is expected in the fixed schema the
/train batch prompt now asks for: a top-level "images" array, each entry
shaped { "image_type", "position": {x_ratio, y_ratio, width_ratio,
height_ratio}, "crop": "none" | {top, bottom, left, right} }. Those get
flattened into per-image columns (image_N_type, image_N_position_x, etc.).
Results from before this schema existed won't match it — those rows are
left blank for the image_N_* columns rather than guessing at their old,
inconsistent shapes, and are listed at the end so they can be reprocessed
under the new prompt if needed.
"""
import argparse
import json
import os
import sys

import pandas as pd


def parse_args():
    parser = argparse.ArgumentParser(
        description="Merge a training-batch JSONL with its results.json into one CSV, and run early exploration on it."
    )
    parser.add_argument("jsonl_path", help="Path to the original training-batch .jsonl file exported from /train.")
    parser.add_argument("results_path", help="Path to the results.json produced by check_batch.py / reparse_errors.py.")
    parser.add_argument("--output", default="training_dataset.csv",
                         help="Path to write the merged CSV to (default: training_dataset.csv).")
    return parser.parse_args()


def load_jsonl(path):
    """Returns {custom_id: request_object}, skipping malformed lines with a warning."""
    entries = {}
    line_num = 0
    with open(path, "r", encoding="utf-8") as f:
        for line_num, raw_line in enumerate(f, start=1):
            line = raw_line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError as e:
                print(f"Warning: skipping line {line_num} in {path} (invalid JSON): {e}", file=sys.stderr)
                continue
            custom_id = obj.get("custom_id")
            if not custom_id:
                print(f"Warning: skipping line {line_num} in {path} (missing custom_id)", file=sys.stderr)
                continue
            entries[custom_id] = obj
    return entries


def extract_prompt_text(request_obj):
    """Pull the text content block out of a batch request's messages."""
    try:
        content = request_obj["params"]["messages"][0]["content"]
    except (KeyError, IndexError, TypeError):
        return ""
    for block in content:
        if isinstance(block, dict) and block.get("type") == "text":
            return block.get("text", "")
    return ""


def parse_known_values(prompt_text):
    """Parse the "Known ground-truth values:" bullet list out of a prompt
    string built by lib/trainExport.ts, returning {label: raw_value_string}.

    Values can themselves span multiple lines (e.g. a multi-line title, or
    "Presenters (one per line)" whose value is the raw lines that follow
    it) — anything that doesn't start a new "- " bullet is treated as a
    continuation of the current one. The one sharp edge: a value line that
    itself happens to start with "- " would be misread as a new bullet;
    acceptable for this exploratory-only use, not bulletproof against it.
    """
    lines = prompt_text.splitlines()

    try:
        start = next(i for i, l in enumerate(lines) if l.strip() == "Known ground-truth values:") + 1
    except StopIteration:
        return {}

    end = len(lines)
    for i in range(start, len(lines)):
        stripped = lines[i].strip()
        if stripped.startswith("Based on the attached") or stripped.startswith("Review the attached"):
            end = i
            break

    known = {}
    current_key = None
    current_value_lines = []

    def flush():
        if current_key is not None:
            known[current_key] = "\n".join(current_value_lines).strip()

    for line in lines[start:end]:
        if line.startswith("- "):
            flush()
            rest = line[2:]
            if ": " in rest:
                key, value = rest.split(": ", 1)
            else:
                key, value = rest.rstrip(":"), ""
            current_key = key.strip()
            current_value_lines = [value]
        elif current_key is not None:
            current_value_lines.append(line)

    flush()

    for key, value in list(known.items()):
        v = value.strip()
        if len(v) >= 2 and v.startswith('"') and v.endswith('"'):
            v = v[1:-1]
        known[key] = v

    return known


IMAGE_POSITION_KEYS = ("x_ratio", "y_ratio", "width_ratio", "height_ratio")
IMAGE_CROP_KEYS = ("top", "bottom", "left", "right")


def image_matches_fixed_schema(img):
    """True if a single image entry matches the schema the /train prompt now
    asks for: {"image_type", "position": {x_ratio, y_ratio, width_ratio,
    height_ratio}, "crop": "none" | {top, bottom, left, right}}."""
    if not isinstance(img, dict) or "image_type" not in img:
        return False
    position = img.get("position")
    if not isinstance(position, dict) or not all(k in position for k in IMAGE_POSITION_KEYS):
        return False
    crop = img.get("crop")
    if crop == "none":
        return True
    return isinstance(crop, dict) and all(k in crop for k in IMAGE_CROP_KEYS)


def extract_image_fields(result):
    """Flatten a result's "images" array into image_N_* columns.

    Returns (fields, matched_schema). matched_schema is False when the
    result doesn't match the fixed schema — either there's no "images" array
    but some old-format image-ish key is present, or an entry inside
    "images" doesn't match — in which case fields is always {} (no partial
    credit; the caller leaves the whole row's image columns blank and flags
    it). A result with genuinely no images at all (no "images" array and no
    old-format image keys either) is not an error — matched_schema is True.
    """
    images = result.get("images")

    if not isinstance(images, list):
        has_legacy_image_keys = any(k.startswith("image") for k in result.keys())
        return {}, not has_legacy_image_keys

    if not all(image_matches_fixed_schema(img) for img in images):
        return {}, False

    fields = {}
    for i, img in enumerate(images, start=1):
        position = img["position"]
        crop = img["crop"]
        fields[f"image_{i}_type"] = img["image_type"]
        fields[f"image_{i}_position_x"] = position["x_ratio"]
        fields[f"image_{i}_position_y"] = position["y_ratio"]
        fields[f"image_{i}_width_ratio"] = position["width_ratio"]
        fields[f"image_{i}_height_ratio"] = position["height_ratio"]
        fields[f"image_{i}_crop"] = "none" if crop == "none" else json.dumps(crop)

    return fields, True


def build_rows(jsonl_entries, results):
    rows = []
    skipped = []
    old_format_ids = []

    for custom_id, request_obj in jsonl_entries.items():
        result = results.get(custom_id)
        if result is None or not isinstance(result, dict):
            skipped.append(custom_id)
            continue

        known = parse_known_values(extract_prompt_text(request_obj))

        title = known.get("Title", "")
        subtitle = known.get("Subtitle", "")
        subtitle2 = known.get("Subtitle 2", "")
        presenters_raw = known.get("Presenters (one per line)", "")
        presenters_list = [p.strip() for p in presenters_raw.split("\n") if p.strip()]

        row = {
            "custom_id": custom_id,
            # --- from the JSONL request ---
            "screen_type": request_obj.get("screen_type"),
            "has_label": request_obj.get("has_label"),
            "has_logos": request_obj.get("has_logos"),
            "has_qr_code": request_obj.get("has_qr_code"),
            "image_count": request_obj.get("image_count"),
            "title": title,
            "subtitle": subtitle or None,
            "subtitle2": subtitle2 or None,
            "presenters": "; ".join(presenters_list) if presenters_list else None,
            "series_name": request_obj.get("series_name") or None,
            "listening_credit": request_obj.get("listening_credit") or None,
            "background_color": known.get("Background color") or None,
            "text_color": known.get("Text color") or None,
            # --- derived ---
            "title_char_count": len(title),
            "subtitle_char_count": len(subtitle) if subtitle else 0,
            "presenter_count": len(presenters_list),
            "has_subtitle2": bool(subtitle2),
        }

        # --- from results.json: named fields explicitly ---
        row["title_font_size_ratio"] = result.get("title_font_size_ratio")
        if "subtitle_font_size_ratio" in result:
            row["subtitle_font_size_ratio"] = result.get("subtitle_font_size_ratio")
        if "had_trailing_text" in result:
            row["had_trailing_text"] = result.get("had_trailing_text")

        # --- image_N_* columns, fixed schema only ---
        image_fields, matched_schema = extract_image_fields(result)
        row.update(image_fields)
        if not matched_schema:
            old_format_ids.append(custom_id)

        rows.append(row)

    return rows, skipped, old_format_ids


def print_exploration(df):
    print()
    print("=" * 70)
    print("EARLY EXPLORATION — first look only, not a fitted model")
    print("=" * 70)
    print(f"This dataset has {len(df)} row(s). Anything below is directional,")
    print("not a statistically meaningful result — treat it as a starting")
    print("point for what to look at, not a conclusion.")
    print()

    # --- 1. title_font_size_ratio by screen_type ---
    print("-" * 70)
    print("title_font_size_ratio by screen_type")
    print("-" * 70)
    if "title_font_size_ratio" in df.columns and df["title_font_size_ratio"].notna().any():
        summary = df.groupby("screen_type")["title_font_size_ratio"].agg(["mean", "min", "max", "count"])
        print(summary.to_string())
    else:
        print("(no title_font_size_ratio values found)")
    print()

    # --- 2. title_char_count vs title_font_size_ratio ---
    print("-" * 70)
    print("title_char_count vs title_font_size_ratio (sorted by char count)")
    print("-" * 70)
    cols = [c for c in ["custom_id", "title_char_count", "title_font_size_ratio"] if c in df.columns]
    print(df[cols].sort_values("title_char_count").to_string(index=False))
    print()

    # --- 3. Outlier flagging ---
    print("-" * 70)
    print("Potential outliers: |title_font_size_ratio - median| > 1.5x IQR")
    print("-" * 70)
    series = df["title_font_size_ratio"].dropna()
    if len(series) >= 4:
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        median = series.median()
        if iqr == 0:
            print("(IQR is 0 — all values identical or too little spread to flag outliers)")
        else:
            threshold = 1.5 * iqr
            outliers = df[(df["title_font_size_ratio"] - median).abs() > threshold]
            if outliers.empty:
                print("(none found)")
            else:
                print(outliers[["custom_id", "title_font_size_ratio"]].to_string(index=False))
            print(f"(median={median:.4f}, IQR={iqr:.4f}, flagged if farther than {threshold:.4f} from the median)")
    else:
        print(f"(only {len(series)} non-null value(s) — need at least 4 to compute a meaningful IQR)")
    print()

    # --- 4. Sparse screen_type / has_label combinations ---
    print("-" * 70)
    print("screen_type / has_label combinations with fewer than 3 examples")
    print("-" * 70)
    combo_counts = df.groupby(["screen_type", "has_label"]).size()
    sparse = combo_counts[combo_counts < 3]
    if sparse.empty:
        print("(none — every combination present has at least 3 examples)")
    else:
        print(sparse.to_string())
        print("These splits have too little data to draw any conclusions from yet.")
    print()


def main():
    args = parse_args()

    if not os.path.isfile(args.jsonl_path):
        print(f"Error: file not found: {args.jsonl_path}", file=sys.stderr)
        sys.exit(1)
    if not os.path.isfile(args.results_path):
        print(f"Error: file not found: {args.results_path}", file=sys.stderr)
        sys.exit(1)

    jsonl_entries = load_jsonl(args.jsonl_path)
    with open(args.results_path, "r", encoding="utf-8") as f:
        results = json.load(f)

    rows, skipped, old_format_ids = build_rows(jsonl_entries, results)

    if skipped:
        print(f"Warning: {len(skipped)} entr{'y' if len(skipped) == 1 else 'ies'} in {args.jsonl_path} had no "
              f"matching (successfully parsed) result in {args.results_path} and were skipped:", file=sys.stderr)
        for cid in skipped:
            print(f"  - {cid}", file=sys.stderr)

    if old_format_ids:
        print(f"Note: {len(old_format_ids)} entr{'y' if len(old_format_ids) == 1 else 'ies'} used an "
              f"older/unrecognized image result format — image_N_* columns were left blank for these. "
              f"Reprocess under the current prompt schema if you need their image data:")
        for cid in old_format_ids:
            print(f"  - {cid}")

    if not rows:
        print("Error: no matched entries to build a dataset from.", file=sys.stderr)
        sys.exit(1)

    df = pd.DataFrame(rows)
    df.to_csv(args.output, index=False)
    print(f"Built dataset with {len(df)} row(s) -> {args.output}")

    print_exploration(df)


if __name__ == "__main__":
    main()
