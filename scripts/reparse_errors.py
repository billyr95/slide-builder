#!/usr/bin/env python3
"""
Re-attempt JSON extraction on entries in an errors.json file, using
check_batch.py's current parsing logic, and move any newly-recovered
entries into results.json.

Useful after check_batch.py's JSON-extraction logic gets improved (e.g. to
tolerate trailing prose around the JSON) — re-run this against an existing
errors.json instead of re-submitting/re-downloading the whole batch.

Usage:
    python reparse_errors.py
    python reparse_errors.py --errors errors.json --results results.json

Only entries with reason "unparseable_json_response" (the ones that have
raw_text to re-parse) are attempted. Entries from actual API errors or
canceled/expired requests have no text to re-parse and are left untouched.
"""
import argparse
import json
import os
import sys

# Reuse the exact same extraction logic check_batch.py uses, so this script
# can never drift out of sync with it.
from check_batch import parse_model_json


def parse_args():
    parser = argparse.ArgumentParser(
        description="Re-parse unparseable entries in errors.json and move recovered ones into results.json."
    )
    parser.add_argument("--errors", default="errors.json",
                         help="Path to the errors.json file to re-attempt (default: errors.json).")
    parser.add_argument("--results", default="results.json",
                         help="Path to the results.json file to merge recovered entries into (default: results.json).")
    return parser.parse_args()


def load_json(path, default):
    if not os.path.isfile(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    args = parse_args()

    if not os.path.isfile(args.errors):
        print(f"Error: errors file not found: {args.errors}", file=sys.stderr)
        sys.exit(1)

    errors = load_json(args.errors, {})
    results = load_json(args.results, {})

    recovered = 0
    still_failed = 0
    remaining_errors = {}

    for custom_id, info in errors.items():
        if info.get("reason") != "unparseable_json_response" or "raw_text" not in info:
            remaining_errors[custom_id] = info
            continue

        try:
            parsed, had_trailing_text = parse_model_json(info["raw_text"])
        except (json.JSONDecodeError, ValueError) as e:
            updated = dict(info)
            updated["error"] = str(e)  # keep raw_text, refresh the error message
            remaining_errors[custom_id] = updated
            still_failed += 1
            continue

        if had_trailing_text:
            parsed["had_trailing_text"] = True
        results[custom_id] = parsed
        recovered += 1

    with open(args.results, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    if remaining_errors:
        with open(args.errors, "w", encoding="utf-8") as f:
            json.dump(remaining_errors, f, indent=2, ensure_ascii=False)
    elif os.path.isfile(args.errors):
        # Nothing left to report — remove the now-empty errors file rather
        # than leaving a stale `{}` behind.
        os.remove(args.errors)

    print(f"Re-checked {len(errors)} error entr{'y' if len(errors) == 1 else 'ies'}.")
    print(f"  Recovered: {recovered} -> {args.results}")
    print(f"  Still failing: {still_failed}")
    skipped = len(errors) - recovered - still_failed
    if skipped:
        print(f"  Skipped (not a parse error, e.g. API error/canceled/expired): {skipped}")


if __name__ == "__main__":
    main()
