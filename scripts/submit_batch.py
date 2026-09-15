#!/usr/bin/env python3
"""
Submit a Claude Batch API job from a JSONL file of batch requests.

Usage:
    python submit_batch.py <path-to-jsonl>

Each line of the input file must be a JSON object with at least:
    { "custom_id": "...", "params": { "model": ..., "max_tokens": ..., "messages": [...] } }

This matches the format produced by the /train training-data bundler's
"Export batch (.jsonl)" button. Any other top-level fields on a line (e.g.
screen_type, has_label, image_count — metadata the bundler adds for its own
filtering) are ignored here; only custom_id/params are sent to the API.

Requires the ANTHROPIC_API_KEY environment variable to be set:
    export ANTHROPIC_API_KEY=sk-ant-...
"""
import json
import os
import sys

try:
    import anthropic
except ImportError:
    print("Error: the 'anthropic' package is required. Install it with:", file=sys.stderr)
    print("    pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)


def load_requests(path):
    """Read the JSONL file, skipping (and warning about) any malformed lines."""
    requests = []
    skipped = 0
    line_num = 0

    with open(path, "r", encoding="utf-8") as f:
        for line_num, raw_line in enumerate(f, start=1):
            line = raw_line.strip()
            if not line:
                continue

            try:
                obj = json.loads(line)
            except json.JSONDecodeError as e:
                print(f"Warning: skipping line {line_num} (invalid JSON): {e}", file=sys.stderr)
                skipped += 1
                continue

            custom_id = obj.get("custom_id")
            params = obj.get("params")
            if not custom_id or not params:
                print(f"Warning: skipping line {line_num} (missing custom_id or params)", file=sys.stderr)
                skipped += 1
                continue

            requests.append({"custom_id": custom_id, "params": params})

    if skipped:
        print(f"Skipped {skipped} malformed/incomplete line(s) out of {line_num} total.", file=sys.stderr)

    return requests


def main():
    if len(sys.argv) != 2:
        print("Usage: python submit_batch.py <path-to-jsonl>", file=sys.stderr)
        sys.exit(1)

    jsonl_path = sys.argv[1]
    if not os.path.isfile(jsonl_path):
        print(f"Error: file not found: {jsonl_path}", file=sys.stderr)
        sys.exit(1)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: the ANTHROPIC_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    requests = load_requests(jsonl_path)
    if not requests:
        print("Error: no valid requests found in the file — nothing to submit.", file=sys.stderr)
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    print(f"Submitting {len(requests)} request(s) from {jsonl_path}...")
    try:
        batch = client.messages.batches.create(requests=requests)
    except anthropic.APIError as e:
        print(f"Error: batch submission failed: {e}", file=sys.stderr)
        sys.exit(1)

    print()
    print("Batch submitted.")
    print(f"  Batch ID: {batch.id}")
    print(f"  Status:   {batch.processing_status}")
    print()
    print("Note: the Batch API does not return results immediately — processing")
    print("can take anywhere from a few minutes up to 24 hours depending on load.")
    print(f"Check on it later with:")
    print(f"    python check_batch.py {batch.id}")


if __name__ == "__main__":
    main()
