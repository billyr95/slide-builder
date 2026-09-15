#!/usr/bin/env python3
"""
Check (or poll) a Claude Batch API job, and once it's finished, download its
results and save them to a local JSON file.

Usage:
    python check_batch.py <batch-id>
    python check_batch.py <batch-id> --poll
    python check_batch.py <batch-id> --poll --interval 60 --output results.json --errors errors.json

By default this checks the batch's status once and exits — the Batch API can
take minutes to hours to finish, so re-run the script later, or pass --poll
to have it keep checking (blocking) until the batch ends.

Requires the ANTHROPIC_API_KEY environment variable to be set:
    export ANTHROPIC_API_KEY=sk-ant-...
"""
import argparse
import json
import os
import sys
import time

try:
    import anthropic
except ImportError:
    print("Error: the 'anthropic' package is required. Install it with:", file=sys.stderr)
    print("    pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)


def parse_args():
    parser = argparse.ArgumentParser(description="Check/poll a Claude Batch API job and save its results.")
    parser.add_argument("batch_id", help="The Batch API job ID (e.g. msgbatch_...)")
    parser.add_argument("--poll", action="store_true",
                         help="Keep checking until the batch finishes, instead of checking once and exiting.")
    parser.add_argument("--interval", type=int, default=30,
                         help="Seconds between checks when --poll is set (default: 30).")
    parser.add_argument("--output", default="results.json",
                         help="Path to write successfully parsed results to (default: results.json).")
    parser.add_argument("--errors", default="errors.json",
                         help="Path to write malformed/errored entries to (default: errors.json).")
    return parser.parse_args()


def get_client():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: the ANTHROPIC_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    return anthropic.Anthropic(api_key=api_key)


def print_status(batch):
    counts = batch.request_counts
    print(
        f"Batch {batch.id}: status={batch.processing_status}  "
        f"(succeeded={counts.succeeded}, errored={counts.errored}, "
        f"processing={counts.processing}, canceled={counts.canceled}, expired={counts.expired})"
    )


def wait_for_batch(client, batch_id, poll, interval):
    """Returns the finished batch, or exits early if not done and --poll wasn't passed."""
    while True:
        batch = client.messages.batches.retrieve(batch_id)
        print_status(batch)

        if batch.processing_status == "ended":
            return batch

        if not poll:
            print("Batch is not finished yet. Re-run with --poll to wait for it, or check again later.")
            sys.exit(0)

        time.sleep(interval)


def extract_text(message):
    """Concatenate all text blocks in a Message's content into one string."""
    parts = []
    for block in message.content:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    return "".join(parts)


def parse_model_json(text):
    """Extract and parse a JSON object from the model's text output.

    Handles markdown code fences, and — since models sometimes add prose
    before or after the JSON instead of returning JSON only — extracts just
    the outermost {...} span rather than requiring the whole string to be
    valid JSON. These responses are always a single flat object (never an
    array or multiple top-level values), so "first { to last }" is enough.

    Returns (parsed_dict, had_trailing_text): had_trailing_text is True if
    anything besides whitespace/fences had to be discarded to parse it, so
    callers can flag entries that needed this fallback.
    """
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if "\n" in cleaned:
            first_line, rest = cleaned.split("\n", 1)
            if first_line.strip().lower() in ("json", ""):
                cleaned = rest
        cleaned = cleaned.strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("No JSON object found in response text")

    candidate = cleaned[start:end + 1]
    had_trailing_text = bool(cleaned[:start].strip()) or bool(cleaned[end + 1:].strip())

    parsed = json.loads(candidate)
    return parsed, had_trailing_text


def process_results(client, batch_id):
    """Streams the batch's per-request results, returning (results, errors) dicts keyed by custom_id."""
    results = {}
    errors = {}
    total = 0

    for entry in client.messages.batches.results(batch_id):
        total += 1
        # Fall back to a positional key if a malformed entry is somehow missing its own id.
        custom_id = getattr(entry, "custom_id", None) or f"unknown-{total}"

        try:
            result_type = entry.result.type

            if result_type == "succeeded":
                text = extract_text(entry.result.message)
                try:
                    parsed, had_trailing_text = parse_model_json(text)
                except (json.JSONDecodeError, ValueError) as e:
                    errors[custom_id] = {
                        "reason": "unparseable_json_response",
                        "error": str(e),
                        "raw_text": text,
                    }
                else:
                    if had_trailing_text:
                        parsed["had_trailing_text"] = True
                    results[custom_id] = parsed

            elif result_type == "errored":
                # entry.result.error is an ErrorResponse wrapper — the actual
                # type/message live one level deeper, on its own .error.
                inner_error = getattr(entry.result.error, "error", None)
                errors[custom_id] = {
                    "reason": "api_error",
                    "error_type": getattr(inner_error, "type", None),
                    "message": getattr(inner_error, "message", str(entry.result.error)),
                }

            elif result_type in ("canceled", "expired"):
                errors[custom_id] = {"reason": result_type}

            else:
                errors[custom_id] = {"reason": "unknown_result_type", "result_type": str(result_type)}

        except Exception as e:
            # Catch-all so one malformed/unexpected entry never crashes the whole run.
            errors[custom_id] = {"reason": "unexpected_exception", "error": str(e)}

    return results, errors, total


def main():
    args = parse_args()
    client = get_client()

    batch = wait_for_batch(client, args.batch_id, args.poll, args.interval)

    print("Batch finished. Downloading results...")
    results, errors, total = process_results(client, batch.id)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    if errors:
        with open(args.errors, "w", encoding="utf-8") as f:
            json.dump(errors, f, indent=2, ensure_ascii=False)

    print(f"Processed {total} result(s).")
    print(f"  {len(results)} succeeded -> {args.output}")
    if errors:
        print(f"  {len(errors)} failed/unparseable -> {args.errors}")
    else:
        print("  0 errors.")


if __name__ == "__main__":
    main()
