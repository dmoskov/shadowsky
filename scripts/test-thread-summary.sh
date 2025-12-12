#!/bin/bash
# Test the thread-summary API endpoint

API_URL="https://api.shadowsky.io/api/thread-summary"

# Use provided DID or default
DID="${1:-did:plc:testuser}"

echo "Testing thread-summary API..."
echo "Using DID: $DID"
echo ""

# Simple test with a few posts
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-bsky-did: $DID" \
  -d '{
    "posts": [
      {"text": "This is the root post about an important topic", "author": "user1", "authorHandle": "user1.bsky.social", "likes": 100, "replies": 50, "reposts": 20, "depth": 0},
      {"text": "I agree with this take!", "author": "user2", "authorHandle": "user2.bsky.social", "likes": 10, "replies": 2, "reposts": 0, "depth": 1},
      {"text": "Interesting perspective", "author": "user3", "authorHandle": "user3.bsky.social", "likes": 5, "replies": 1, "reposts": 0, "depth": 1},
      {"text": "Not sure I agree with this", "author": "user4", "authorHandle": "user4.bsky.social", "likes": 0, "replies": 0, "reposts": 0, "depth": 1}
    ],
    "format": "tldr"
  }' | jq .

echo ""
echo "Done."
