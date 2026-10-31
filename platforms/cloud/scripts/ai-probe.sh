#!/bin/sh
# Calls Mistral twice with the same prompt_cache_key and prints each SSE
# event pretty-printed, so you can see the prefix-cache hit in the usage
# chunk of the second call (usage.prompt_tokens_details.cached_tokens > 0).
#
# Usage:  AI_API_KEY=sk-... sh platforms/cloud/scripts/ai-probe.sh [model]

set -eu

MODEL="${1:-mistral-small-latest}"
: "${AI_API_KEY:?set AI_API_KEY first, e.g. AI_API_KEY=sk-... sh $0}"

BODY=$(mktemp)
trap 'rm -f "$BODY"' EXIT
printf '%s' "{\"model\":\"$MODEL\",\"prompt_cache_key\":\"hyperbook:probe\",\"messages\":[{\"role\":\"system\",\"content\":\"You are a concise assistant for writing Hyperbook pages in German. Answer in German.\"},{\"role\":\"user\",\"content\":\"Schreibe einen kurzen Absatz ueber Photosynthese fuer ein Schulbuch.\"}],\"max_tokens\":256,\"stream\":true,\"stream_options\":{\"include_usage\":true}}" > "$BODY"

i=1
while [ "$i" -le 2 ]; do
  echo "=== call $i (model: $MODEL) ==="
  curl -sS https://api.mistral.ai/v1/chat/completions \
    -H "authorization: Bearer $AI_API_KEY" \
    -H "content-type: application/json" \
    --data-binary @"$BODY" \
  | while IFS= read -r line; do
      case "$line" in
        "data: "*)
          payload="${line#data: }"
          [ "$payload" = "[DONE]" ] && break
          printf '%s' "$payload" | jq -c 'if .usage then {prompt: .usage.prompt_tokens, cached: .usage.prompt_tokens_details.cached_tokens, completion: .usage.completion_tokens} else .choices[0].delta.content end'
          ;;
      esac
    done
  i=$((i + 1))
done
