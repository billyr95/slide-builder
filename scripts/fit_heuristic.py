#!/usr/bin/env python3
"""
Fit a first-pass slide-layout heuristic from training_dataset.csv and print
ready-to-paste TypeScript functions for lib/slideHeuristics.ts.

This is intentionally NOT a trained model file (no pickle/ONNX/etc.) — with
only ~39 rows, anything fancier than grouped-average lookups would be
overfitting theater. Every number below is a median (or a small, explicitly
clamped nudge off a median) computed directly from training_dataset.csv, and
this script re-derives and prints them each run rather than hardcoding
constants anywhere else, so refitting on a bigger export later is just
"rerun this script."

Usage:
    python fit_heuristic.py <training_dataset.csv> [--output slideHeuristics.ts]

DISCLAIMER printed at the end of every run: this is fit on a small sample
(currently 39 rows) with real noise and confounding between features (e.g.
has_subtitle and image_1_type are not independent of each other in this
sample). Treat it as a reasonable starting default, not a final model —
refit as more /train data comes in.
"""
import argparse
import json
import sys

import pandas as pd

OUTLIER_IQR_MULTIPLIER = 1.5
NUDGE_CLAMP = 8  # px — caps how much any single secondary factor can move the title suggestion


def parse_args():
    parser = argparse.ArgumentParser(description="Fit a first-pass slide-layout heuristic from training_dataset.csv.")
    parser.add_argument("csv_path", help="Path to training_dataset.csv (from merge_and_explore.py).")
    parser.add_argument("--output", default="slideHeuristics.ts",
                         help="Path to write the generated TypeScript to (default: slideHeuristics.ts).")
    return parser.parse_args()


def flag_outliers(df, value_col, label):
    """Print rows whose value_col is more than OUTLIER_IQR_MULTIPLIER * IQR
    from the median — same convention used in merge_and_explore.py. Returns
    nothing; this is purely for manual review, not filtering."""
    series = df[value_col].dropna()
    if len(series) < 4:
        print(f"    ({label}: only {len(series)} value(s) — too few to compute a meaningful IQR)")
        return
    q1, q3 = series.quantile(0.25), series.quantile(0.75)
    iqr = q3 - q1
    if iqr == 0:
        return
    median = series.median()
    threshold = OUTLIER_IQR_MULTIPLIER * iqr
    outliers = df[(df[value_col] - median).abs() > threshold]
    if not outliers.empty:
        print(f"    Outliers in {label} (|value - median| > {threshold:.3f}, for optional review):")
        for _, row in outliers.iterrows():
            print(f"      - {row['custom_id']}: {value_col}={row[value_col]}")


# ---------------------------------------------------------------------------
# Title font size
# ---------------------------------------------------------------------------

def fit_title_font_size(df):
    print("=" * 70)
    print("TITLE FONT SIZE")
    print("=" * 70)

    d = df.copy()
    d["has_subtitle"] = d["subtitle"].notna()
    d["chars_per_line"] = d["title_char_count"] / d["title_line_count"]

    overall_median = d["title_font_size_px"].median()
    print(f"Overall median title_font_size_px: {overall_median}  (n={len(d)})")

    # Primary driver: chars-per-line, bucketed. Thresholds (12, 16) are the
    # natural breakpoints in this dataset's sorted chars_per_line values —
    # not a universal constant, just where this sample's distribution splits
    # into three usably-sized, meaningfully different groups. Re-examine
    # these breakpoints when refitting on more data.
    def bucket(cpl):
        if cpl <= 12:
            return "<=12"
        if cpl <= 16:
            return "12-16"
        return ">16"

    d["bucket"] = d["chars_per_line"].apply(bucket)
    bucket_stats = d.groupby("bucket")["title_font_size_px"].agg(["median", "count"])
    print("\nPrimary bucket (chars-per-line) medians:")
    print(bucket_stats.to_string())
    bucket_medians = bucket_stats["median"].to_dict()
    for b in ("<=12", "12-16", ">16"):
        flag_outliers(d[d["bucket"] == b], "title_font_size_px", f"bucket {b}")

    # Secondary nudges: each is (group median - overall median), clamped to
    # +/- NUDGE_CLAMP px so no single weak/noisy factor can dominate the
    # bucket-level signal above. All three below show a real (if modest)
    # difference in this sample; none is strong enough to trust standalone.
    def clamped_nudge(series_for_group):
        if len(series_for_group) < 3:
            return 0.0
        delta = float(series_for_group.median()) - overall_median
        return float(max(-NUDGE_CLAMP, min(NUDGE_CLAMP, delta)))

    subtitle_nudges = {
        has_sub: clamped_nudge(g["title_font_size_px"])
        for has_sub, g in d.groupby("has_subtitle")
    }
    print("\nhas_subtitle nudges (clamped +/-{}px off overall median):".format(NUDGE_CLAMP))
    print(f"  {subtitle_nudges}")

    screen_nudges = {
        st: clamped_nudge(g["title_font_size_px"])
        for st, g in d.groupby("screen_type")
    }
    print("screen_type nudges:")
    print(f"  {screen_nudges}")

    image_nudges = {
        it: clamped_nudge(g["title_font_size_px"])
        for it, g in d.groupby("image_1_type", dropna=True)
    }
    print("image_1_type nudges:")
    print(f"  {image_nudges}")

    return {
        "overallMedian": overall_median,
        "bucketMedians": bucket_medians,
        "subtitleNudges": {str(k): v for k, v in subtitle_nudges.items()},
        "screenNudges": screen_nudges,
        "imageNudges": {str(k): v for k, v in image_nudges.items() if pd.notna(k)},
    }


# ---------------------------------------------------------------------------
# Subtitle font size
# ---------------------------------------------------------------------------

def fit_subtitle_font_size(df):
    print()
    print("=" * 70)
    print("SUBTITLE FONT SIZE")
    print("=" * 70)

    d = df[df["subtitle_font_size_px"].notna()].copy()
    print(f"{len(d)} row(s) have a subtitle_font_size_px value.")

    # line_count and screen_type were both checked and show ~no independent
    # effect in this sample (screen_type medians: lobby 48.0 vs projector
    # 48.0, identical) — so, unlike title, the fitted function below is
    # deliberately just char_count -> bucket median. Padding the signature
    # with params that don't move the output would just be a fake API.
    def bucket(cc):
        if cc <= 10:
            return "<=10"
        if cc <= 16:
            return "10-16"
        return ">16"

    d["bucket"] = d["subtitle_char_count"].apply(bucket)
    bucket_stats = d.groupby("bucket")["subtitle_font_size_px"].agg(["median", "count"])
    print("\nBucket (char_count) medians:")
    print(bucket_stats.to_string())
    for b in ("<=10", "10-16", ">16"):
        flag_outliers(d[d["bucket"] == b], "subtitle_font_size_px", f"bucket {b}")

    if (bucket_stats["count"] < 3).any():
        print("\nNote: at least one bucket has fewer than 3 examples — treat that bucket's default cautiously.")

    return {"bucketMedians": bucket_stats["median"].to_dict()}


# ---------------------------------------------------------------------------
# Image position / crop
# ---------------------------------------------------------------------------

IMAGE_TYPES = ["book_cover", "face", "poster", "graphic"]


def parse_crop(raw):
    """image_1_crop is 'none', a JSON object string, or NaN — normalize to
    a dict or None."""
    if not isinstance(raw, str) or raw == "none":
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None


def median_position(d):
    return {
        "x": round(float(d["image_1_position_x"].median()), 3),
        "y": round(float(d["image_1_position_y"].median()), 3),
        "width": round(float(d["image_1_width_ratio"].median()), 3),
        "height": round(float(d["image_1_height_ratio"].median()), 3),
    }


def median_crop(crops):
    """Median of each field across whatever crop dicts were actually found
    (rows with crop == 'none' are excluded — they contribute nothing to
    what a "modest crop" looks like)."""
    if not crops:
        return None
    return {
        k: round(float(pd.Series([c[k] for c in crops]).median()), 3)
        for k in ("top", "bottom", "left", "right")
    }


def fit_image_position(df):
    print()
    print("=" * 70)
    print("IMAGE POSITION / CROP")
    print("=" * 70)

    d = df[df["image_1_type"].notna()].copy()
    d["crop_parsed"] = d["image_1_crop"].apply(parse_crop)
    print(f"{len(d)} row(s) have image_1_type data ({df['image_1_type'].isna().sum()} row(s) had no image).")

    results = {}

    for img_type in IMAGE_TYPES:
        group = d[d["image_1_type"] == img_type]
        if group.empty:
            continue
        print(f"\n--- {img_type} (n={len(group)}) ---")

        if img_type == "face":
            # Check for the two-cluster split the data actually shows: full
            # (near-full-height) faces vs. cropped-lower/shorter faces.
            tall = group[group["image_1_height_ratio"] > 0.6]
            short = group[group["image_1_height_ratio"] <= 0.6]
            print(f"  height_ratio > 0.6 (tall): n={len(tall)}, screen_type breakdown={tall['screen_type'].value_counts().to_dict()}")
            print(f"  height_ratio <= 0.6 (short): n={len(short)}, screen_type breakdown={short['screen_type'].value_counts().to_dict()}")

            if len(tall) >= 3 and len(short) >= 3:
                print("  -> Two real clusters found. Split correlates partially with screen_type: "
                      "short/lower faces only appear on lobby screens in this sample, but lobby also "
                      "has tall faces (not a clean rule) — treating 'projector' as always-tall and "
                      "'lobby' as the (more common) short cluster, since it's the closest single-value "
                      "default per screen_type; this is a genuine ambiguity to revisit with more data.")
                pos_tall = median_position(tall)
                pos_short = median_position(short)
                flag_outliers(tall, "image_1_position_x", "face/tall x")
                flag_outliers(tall, "image_1_width_ratio", "face/tall width")
                flag_outliers(short, "image_1_width_ratio", "face/short width")
                results["face"] = {"projector": pos_tall, "lobby": pos_short}
                print(f"  Tall default: {pos_tall}")
                print(f"  Short default: {pos_short}")
            else:
                pos = median_position(group)
                results["face"] = {"projector": pos, "lobby": pos}
                print(f"  Not enough rows in both clusters to split confidently — using one default: {pos}")

            crops = [c for c in group["crop_parsed"] if c is not None]
            print(f"  {len(crops)}/{len(group)} face rows had a non-'none' crop.")
            face_crop = median_crop(crops) or {"top": 0, "bottom": 0, "left": 0, "right": 0}
            results["faceCrop"] = face_crop
            print(f"  Median face crop (from rows with an actual crop): {face_crop}")
        else:
            pos = median_position(group)
            flag_outliers(group, "image_1_width_ratio", f"{img_type} width")
            flag_outliers(group, "image_1_height_ratio", f"{img_type} height")
            results[img_type] = pos
            print(f"  Median position: {pos}")

    # "other" / unclassified fallback: no rows of this type exist yet, so
    # there's nothing to fit — pool ALL image rows (any type) into one
    # generic default, since that's the best available estimate of "what an
    # arbitrary attached image on one of these slides tends to look like."
    pooled = median_position(d)
    results["other"] = pooled
    print(f"\n--- other / unclassified (n=0 direct examples) ---")
    print(f"  No 'other'-typed rows exist in this dataset. Falling back to the pooled median across "
          f"all {len(d)} image rows regardless of type: {pooled}")

    return results


# ---------------------------------------------------------------------------
# TypeScript codegen
# ---------------------------------------------------------------------------

def ts_num(x):
    return f"{x:g}"


def generate_ts(title_fit, subtitle_fit, image_fit):
    lines = []
    lines.append("// Auto-generated by scripts/fit_heuristic.py — DO NOT hand-edit the numbers below.")
    lines.append("// Re-run that script against a fresh training_dataset.csv and paste the output here")
    lines.append("// instead of tweaking values by hand.")
    lines.append("//")
    lines.append("// FIRST-PASS HEURISTIC — fit on a small training set (see the script's own console")
    lines.append("// output for the exact row count and every group's sample size). This is deliberately")
    lines.append("// simple grouped-average lookups, not a trained model — expect it to be refit/replaced")
    lines.append("// as more /train data comes in. Treat suggestions as defaults, not ground truth.")
    lines.append("")
    lines.append("export type ScreenTypeLike = 'projector' | 'lobby'")
    lines.append("export type ImageTypeLike = 'book_cover' | 'face' | 'poster' | 'graphic' | 'other'")
    lines.append("")
    lines.append("export interface SuggestedImagePosition {")
    lines.append("  x: number")
    lines.append("  y: number")
    lines.append("  width: number")
    lines.append("  height: number")
    lines.append("  crop: 'none' | { top: number; bottom: number; left: number; right: number }")
    lines.append("}")
    lines.append("")

    # --- suggestTitleFontSize ---
    bm = title_fit["bucketMedians"]
    sn = title_fit["subtitleNudges"]
    scn = title_fit["screenNudges"]
    imn = title_fit["imageNudges"]
    lines.append("/**")
    lines.append(" * Suggest a title font size (px) from a small set of grouped-average lookups:")
    lines.append(" * a primary bucket on chars-per-line, plus up to three secondary nudges (has_subtitle,")
    lines.append(" * screen_type, image_1_type), each clamped to a modest +/-8px so no single weak signal")
    lines.append(" * can dominate. Result is snapped to the nearest 4px, matching the granularity every")
    lines.append(" * fitted value in the training set happened to share, and clamped to the real slider")
    lines.append(" * range (24-160).")
    lines.append(" */")
    lines.append("export function suggestTitleFontSize(")
    lines.append("  charCount: number,")
    lines.append("  lineCount: number,")
    lines.append("  screenType: ScreenTypeLike,")
    lines.append("  hasSubtitle: boolean,")
    lines.append("  imageType?: ImageTypeLike,")
    lines.append("): number {")
    lines.append("  const charsPerLine = lineCount > 0 ? charCount / lineCount : charCount")
    lines.append("")
    lines.append("  let base: number")
    lines.append(f"  if (charsPerLine <= 12) base = {ts_num(bm['<=12'])}")
    lines.append(f"  else if (charsPerLine <= 16) base = {ts_num(bm['12-16'])}")
    lines.append(f"  else base = {ts_num(bm['>16'])}")
    lines.append("")
    lines.append(f"  const subtitleNudge = hasSubtitle ? {ts_num(sn.get('True', 0))} : {ts_num(sn.get('False', 0))}")
    lines.append("")
    lines.append("  const screenNudge: Record<ScreenTypeLike, number> = {")
    for st, v in scn.items():
        lines.append(f"    {st}: {ts_num(v)},")
    lines.append("  }")
    lines.append("")
    lines.append("  const imageNudge: Partial<Record<ImageTypeLike, number>> = {")
    for it, v in imn.items():
        lines.append(f"    {it}: {ts_num(v)},")
    lines.append("  }")
    lines.append("")
    lines.append("  const raw = base + subtitleNudge + screenNudge[screenType] + (imageType ? (imageNudge[imageType] ?? 0) : 0)")
    lines.append("  const snapped = Math.round(raw / 4) * 4")
    lines.append("  return Math.max(24, Math.min(160, snapped))")
    lines.append("}")
    lines.append("")

    # --- suggestSubtitleFontSize ---
    sbm = subtitle_fit["bucketMedians"]
    lines.append("/**")
    lines.append(" * Suggest a subtitle font size (px). Unlike title, screen_type and line_count showed")
    lines.append(" * no independent effect on subtitle_font_size_px in the fitted data (lobby/projector")
    lines.append(" * medians were identical) — so this is intentionally just a char-count bucket lookup,")
    lines.append(" * not padded with unused parameters.")
    lines.append(" */")
    lines.append("export function suggestSubtitleFontSize(charCount: number): number {")
    lines.append("  let base: number")
    lines.append(f"  if (charCount <= 10) base = {ts_num(sbm['<=10'])}")
    lines.append(f"  else if (charCount <= 16) base = {ts_num(sbm['10-16'])}")
    lines.append(f"  else base = {ts_num(sbm['>16'])}")
    lines.append("  return Math.max(16, Math.min(120, base))")
    lines.append("}")
    lines.append("")

    # --- suggestImagePosition ---
    lines.append("const IMAGE_POSITION: Record<Exclude<ImageTypeLike, 'face'>, SuggestedImagePosition> = {")
    for it in ("book_cover", "poster", "graphic", "other"):
        p = image_fit[it]
        lines.append(f"  {it}: {{ x: {ts_num(p['x'])}, y: {ts_num(p['y'])}, width: {ts_num(p['width'])}, height: {ts_num(p['height'])}, crop: 'none' }},")
    lines.append("}")
    lines.append("")
    face = image_fit["face"]
    face_crop = image_fit["faceCrop"]
    lines.append("// Faces showed two real position clusters in the fitted data (split on height_ratio")
    lines.append("// > 0.6): near-full-height headshots vs. shorter/lower-placed ones. The split correlates")
    lines.append("// only partially with screen_type (lobby has both; projector was consistently tall in")
    lines.append("// this sample) — treated here as the closest single default per screen_type pending more data.")
    lines.append("const FACE_POSITION: Record<ScreenTypeLike, SuggestedImagePosition> = {")
    for st in ("projector", "lobby"):
        p = face[st]
        crop_str = (
            f"{{ top: {ts_num(face_crop['top'])}, bottom: {ts_num(face_crop['bottom'])}, "
            f"left: {ts_num(face_crop['left'])}, right: {ts_num(face_crop['right'])} }}"
        )
        lines.append(f"  {st}: {{ x: {ts_num(p['x'])}, y: {ts_num(p['y'])}, width: {ts_num(p['width'])}, height: {ts_num(p['height'])}, crop: {crop_str} }},")
    lines.append("}")
    lines.append("")
    lines.append("/**")
    lines.append(" * Suggest a default position/size/crop for a newly-attached image, grouped by the")
    lines.append(" * image's classified type (medians from the fitted data; 'other' falls back to the")
    lines.append(" * pooled median across all image types, since no 'other'-typed examples exist yet).")
    lines.append(" * All values are ratios (0-1) relative to the full slide, matching the /train batch")
    lines.append(" * prompt's image schema.")
    lines.append(" */")
    lines.append("export function suggestImagePosition(imageType: ImageTypeLike, screenType: ScreenTypeLike): SuggestedImagePosition {")
    lines.append("  if (imageType === 'face') return FACE_POSITION[screenType]")
    lines.append("  return IMAGE_POSITION[imageType]")
    lines.append("}")
    lines.append("")

    return "\n".join(lines)


def main():
    args = parse_args()
    df = pd.read_csv(args.csv_path)
    print(f"Loaded {len(df)} row(s) from {args.csv_path}\n")

    title_fit = fit_title_font_size(df)
    subtitle_fit = fit_subtitle_font_size(df)
    image_fit = fit_image_position(df)

    ts_code = generate_ts(title_fit, subtitle_fit, image_fit)
    with open(args.output, "w", encoding="utf-8") as f:
        f.write(ts_code)

    print()
    print("=" * 70)
    print(f"Generated TypeScript written to {args.output}")
    print("=" * 70)
    print(
        f"\nDISCLAIMER: this heuristic is fit on {len(df)} row(s) of real but noisy, confounded\n"
        "data — several groups above have fewer than 5 examples, and several 'signals' used\n"
        "here (has_subtitle, image_1_type, screen_type) are not independent of each other in\n"
        "this sample. Treat every number in the generated file as a reasonable starting\n"
        "default, not a final model. Re-run this script against a fresh, larger\n"
        "training_dataset.csv as more /train data comes in, and expect the fitted values\n"
        "(and possibly the bucket thresholds themselves) to shift."
    )


if __name__ == "__main__":
    main()
