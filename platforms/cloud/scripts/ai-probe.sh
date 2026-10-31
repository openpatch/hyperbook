#!/bin/sh
# Probes Mistral's prefix-cache reporting per model and what the platform
# would charge in AI credits with AI_MODEL_WEIGHTS.
#
# Each model is called twice with the same prompt_cache_key (unique per run,
# so call 1 is always cold and call 2 should hit the prefix cache). The
# platform (src/server/ai/provider.ts) reads cached tokens from
# prompt_tokens_details.cached_tokens, prompt_tokens_cached or cached_tokens
# — a model that reports none has all its input billed at the "in" weight.
# For each call this prints prompt/cached/completion tokens as reported,
# the credits with those numbers, and the credits if the cache hits went
# unreported (the fallback case). The summary shows which models reported
# cache hits — those are the ones whose cached weight matters.
#
# A prompt_cache_key raises the chance of a cache hit but does not guarantee
# one, so the system prompt is padded to ~1k tokens: like the editor's real
# requests (book context), long enough that the cache has something to hit.
#
# Usage:  AI_API_KEY=sk-... sh platforms/cloud/scripts/ai-probe.sh [model ...]
# Defaults to the editor's four models; unknown models weigh 1/1/1.

set -eu

: "${AI_API_KEY:?set AI_API_KEY first, e.g. AI_API_KEY=sk-... sh $0}"
MODELS="${*:-mistral-small-2603 mistral-large-4 zai-glm-5-3-flash zai-glm-5-3}"

# Credit weights per model, in/cached/out — Mistral Small 4 = 1 everywhere.
weights() {
  case "$1" in
    mistral-small-2603) echo "1/1/1" ;;
    mistral-large-4) echo "4.67/4.67/3.5" ;;
    zai-glm-5-3-flash) echo "1/2/0.83" ;;
    zai-glm-5-3) echo "9.33/9.33/7.33" ;;
    *) echo "1/1/1" ;;
  esac
}

# Warn about model ids the account does not list (misspelt ids would fail).
AVAILABLE=$(curl -sS https://api.mistral.ai/v1/models \
  -H "authorization: Bearer $AI_API_KEY" \
  | jq -r '.data[].id' 2>/dev/null) || AVAILABLE=""
for M in $MODELS; do
  if [ -n "$AVAILABLE" ] && ! printf '%s\n' "$AVAILABLE" | grep -qx "$M"; then
    echo "warning: \"$M\" is not in this account's model list" >&2
  fi
done

# ~1k tokens of stable German filler, so the prefix is long enough to cache.
PREFIX="Du bist ein Assistent fuer Hyperbook-Seiten im Schulbuchbereich. Nutze eine klare, altersgerechte Sprache und erwaehne die Photosynthese mit ihren Teil- und Lichtreaktionen sowie die Bedeutung fuer Pflanzen, Tiere und Menschen. "
SYSTEM="You are a concise assistant for writing Hyperbook pages in German. Answer in German. "
i=0
while [ "$i" -lt 30 ]; do SYSTEM="$SYSTEM$PREFIX"; i=$((i + 1)); done

BODY=$(mktemp)
RAW=$(mktemp)
trap 'rm -f "$BODY" "$RAW"' EXIT

# One call; sets P (prompt), C (cached), O (completion) from the usage chunk,
# or ERROR and returns 1 if the API answered without one. The cached-field
# fallback mirrors provider.ts exactly.
probe_call() {
  curl -sS https://api.mistral.ai/v1/chat/completions \
    -H "authorization: Bearer $AI_API_KEY" \
    -H "content-type: application/json" \
    --data-binary @"$BODY" > "$RAW"
  USAGE=$(sed -n 's/^data: //p' "$RAW" | sed '/^\[DONE\]/d' \
    | jq -s '[.[] | select(.usage != null)] | .[0].usage // empty' 2>/dev/null) || USAGE=""
  if [ -z "$USAGE" ]; then
    # no usage chunk — the API answered with an error (e.g. unknown model)
    ERROR=$(jq -r '.detail // .message // .title // empty' "$RAW" 2>/dev/null) || ERROR=""
    [ -n "$ERROR" ] || ERROR=$(head -c 300 "$RAW" | tr '\n' ' ')
    return 1
  fi
  P=$(printf '%s' "$USAGE" | jq '.prompt_tokens // 0')
  C=$(printf '%s' "$USAGE" | jq '.prompt_tokens_details.cached_tokens // .prompt_tokens_cached // .cached_tokens // 0')
  O=$(printf '%s' "$USAGE" | jq '.completion_tokens // 0')
}

SUMMARY=""
for MODEL in $MODELS; do
  W=$(weights "$MODEL")
  WIN=${W%%/*}
  REST=${W#*/}
  WCACHED=${REST%%/*}
  WOUT=${REST##*/}
  # $$ keeps the cache key unique per run, so call 1 starts cold every time
  printf '%s' "{\"model\":\"$MODEL\",\"prompt_cache_key\":\"hyperbook:probe:$$\",\"messages\":[{\"role\":\"system\",\"content\":\"$SYSTEM\"},{\"role\":\"user\",\"content\":\"Schreibe einen kurzen Absatz ueber Photosynthese fuer ein Schulbuch.\"}],\"max_tokens\":256,\"stream\":true,\"stream_options\":{\"include_usage\":true}}" > "$BODY"

  echo "=== $MODEL (weights: in $WIN, cached $WCACHED, out $WOUT) ==="
  FAILED=0
  for i in 1 2; do
    if probe_call; then
      CREDITS=$(awk -v p="$P" -v c="$C" -v o="$O" -v wi="$WIN" -v wc="$WCACHED" -v wo="$WOUT" \
        'BEGIN { printf "%.1f", (p - c) * wi + c * wc + o * wo }')
      UNREPORTED=$(awk -v p="$P" -v o="$O" -v wi="$WIN" -v wo="$WOUT" \
        'BEGIN { printf "%.1f", p * wi + o * wo }')
      printf 'call %d: prompt %s, cached %s, completion %s -> %s credits (%s if cache hits go unreported)\n' \
        "$i" "$P" "$C" "$O" "$CREDITS" "$UNREPORTED"
      if [ "$i" = 2 ]; then C2=$C; fi
    else
      echo "call $i: ERROR — $ERROR"
      FAILED=1
    fi
  done
  if [ "$FAILED" = 1 ]; then
    VERDICT="probe failed — check the model id"
  elif [ "${C2:-0}" -gt 0 ]; then
    VERDICT="reports cache hits (cached weight matters)"
  else
    VERDICT="no cache hit this run — key does not guarantee one; try again before dropping the cached weight"
  fi
  SUMMARY="$SUMMARY
$(printf '%-25s call2 cached: %s — %s' "$MODEL" "$([ "$FAILED" = 1 ] && echo '?' || echo "${C2:-0}")" "$VERDICT")"
  echo
done

echo "=== summary ==="
echo "$SUMMARY" | tail -n +2
