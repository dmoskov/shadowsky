#!/usr/bin/env python3
"""Read-only verification of every advertised PAN feed on both retained hosts."""

import argparse
import concurrent.futures
import json
import urllib.parse
import urllib.request


def read_json(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.load(response)


def verify_host(host, expected):
    base = f"https://{host}/xrpc/"
    feeds = read_json(base + "app.bsky.feed.describeFeedGenerator")["feeds"]

    def verify_feed(feed):
        query = urllib.parse.urlencode({"feed": feed["uri"], "limit": 3})
        result = read_json(base + "app.bsky.feed.getFeedSkeleton?" + query)
        return {"uri": feed["uri"], "posts": len(result.get("feed", []))}

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(verify_feed, feeds))
    if len(results) != expected or any(result["posts"] == 0 for result in results):
        raise RuntimeError(f"{host}: expected {expected} nonempty feeds: {results}")
    return {"host": host, "feed_count": len(results), "feeds": results}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--expected", type=int, default=24,
        help="Pan Curated was separately retired; 24 feeds remained on 2026-09-06.",
    )
    args = parser.parse_args()
    results = [
        verify_host(host, args.expected)
        for host in ("feed.shadowsky.io", "feed.asphodel.is")
    ]
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
