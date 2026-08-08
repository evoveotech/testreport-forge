#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# ─── Colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

banner() { echo -e "\n${CYAN}${BOLD}=== $1 ===${RESET}\n"; }

# ─── Pre-flight ─────────────────────────────────────────────────────────────
banner "Pre-flight checks"

# Ensure Evoveo Smart Reporter is built
if [ ! -f ../dist/smart-reporter.js ]; then
  echo "Building Evoveo Smart Reporter..."
  (cd .. && npm run build)
fi

# Ensure allure-playwright and allure CLI are available
NEEDS_INSTALL=""
if ! node -e "require.resolve('allure-playwright')" 2>/dev/null; then
  NEEDS_INSTALL="allure-playwright"
fi
if ! command -v allure &>/dev/null && [ ! -x "../node_modules/.bin/allure" ]; then
  NEEDS_INSTALL="$NEEDS_INSTALL allure-commandline"
fi
if [ -n "$NEEDS_INSTALL" ]; then
  echo "Installing${NEEDS_INSTALL}..."
  (cd .. && npm install --no-save $NEEDS_INSTALL 2>/dev/null)
fi

# Resolve allure CLI path (requires Java)
ALLURE_CMD=""
if command -v allure &>/dev/null && allure --version &>/dev/null; then
  ALLURE_CMD="allure"
elif [ -x "../node_modules/.bin/allure" ] && ../node_modules/.bin/allure --version &>/dev/null; then
  ALLURE_CMD="../node_modules/.bin/allure"
else
  echo -e "${RED}Note: allure CLI requires Java — report generation step will be skipped.${RESET}"
  echo "  (This is part of the story: Allure needs a JRE; Evoveo Smart Reporter is pure Node.js)"
fi

# Generate specs if missing
if [ ! -d specs ] || [ "$(find specs -name '*.spec.ts' 2>/dev/null | wc -l | tr -d ' ')" -lt 50 ]; then
  echo "Generating spec files..."
  node generate-specs.js
fi

SPEC_COUNT=$(find specs -name '*.spec.ts' | wc -l | tr -d ' ')
echo -e "Spec files: ${GREEN}${SPEC_COUNT}${RESET}"

# ─── Clean results ──────────────────────────────────────────────────────────
rm -rf results
mkdir -p results

# ─── Helper: parse /usr/bin/time -l output ──────────────────────────────────
# macOS /usr/bin/time -l prints "maximum resident set size" in bytes on stderr
parse_rss() {
  local time_output="$1"
  # macOS format: "  <bytes>  maximum resident set size"
  echo "$time_output" | grep "maximum resident set size" | awk '{print $1}'
}

parse_walltime() {
  local time_output="$1"
  # /usr/bin/time outputs "real X.XX" or just the first line with elapsed
  echo "$time_output" | head -1 | awk '{print $1}'
}

format_bytes() {
  local bytes=$1
  if [ "$bytes" -ge 1073741824 ]; then
    echo "$(echo "scale=1; $bytes / 1073741824" | bc)G"
  elif [ "$bytes" -ge 1048576 ]; then
    echo "$(echo "scale=1; $bytes / 1048576" | bc)M"
  elif [ "$bytes" -ge 1024 ]; then
    echo "$(echo "scale=1; $bytes / 1024" | bc)K"
  else
    echo "${bytes}B"
  fi
}

# ─── Run Evoveo Smart Reporter ────────────────────────────────────────────────────
banner "Running Evoveo Smart Reporter (50 specs)"

SMART_TIME_OUTPUT=$( { /usr/bin/time -l npx playwright test --config=evoveo-smart.config.ts 2>&1 1>/dev/null; } 2>&1 ) || true
SMART_RSS=$(parse_rss "$SMART_TIME_OUTPUT")
SMART_WALL=$(parse_walltime "$SMART_TIME_OUTPUT")

SMART_REPORT_SIZE=0
if [ -f results/smart-report.html ]; then
  SMART_REPORT_SIZE=$(stat -f%z results/smart-report.html)
fi

echo -e "Peak RSS: ${GREEN}$(format_bytes "$SMART_RSS")${RESET}"
echo -e "Wall time: ${GREEN}${SMART_WALL}s${RESET}"
echo -e "Report size: ${GREEN}$(format_bytes "$SMART_REPORT_SIZE")${RESET}"

# ─── Run Allure (collection phase) ─────────────────────────────────────────
banner "Running Allure (collection phase, 50 specs)"

ALLURE_COLLECT_OUTPUT=$( { /usr/bin/time -l npx playwright test --config=playwright-allure.config.ts 2>&1 1>/dev/null; } 2>&1 ) || true
ALLURE_COLLECT_RSS=$(parse_rss "$ALLURE_COLLECT_OUTPUT")
ALLURE_COLLECT_WALL=$(parse_walltime "$ALLURE_COLLECT_OUTPUT")

echo -e "Peak RSS: ${GREEN}$(format_bytes "$ALLURE_COLLECT_RSS")${RESET}"
echo -e "Wall time: ${GREEN}${ALLURE_COLLECT_WALL}s${RESET}"

# ─── Run Allure report generation ──────────────────────────────────────────
ALLURE_GEN_RSS=0
ALLURE_GEN_WALL="N/A"
ALLURE_REPORT_SIZE=0
ALLURE_GEN_NOTE="(needs Java)"

if [ -n "$ALLURE_CMD" ] && [ -d results/allure-results ]; then
  banner "Running Allure report generation"

  ALLURE_GEN_OUTPUT=$( { /usr/bin/time -l $ALLURE_CMD generate results/allure-results -o results/allure-report --clean 2>&1 1>/dev/null; } 2>&1 ) || true
  ALLURE_GEN_RSS=$(parse_rss "$ALLURE_GEN_OUTPUT")
  ALLURE_GEN_WALL=$(parse_walltime "$ALLURE_GEN_OUTPUT")
  ALLURE_GEN_NOTE=""

  if [ -d results/allure-report ]; then
    # macOS stat uses -f%z, Linux uses --format=%s
    ALLURE_REPORT_SIZE=$(find results/allure-report -type f -exec stat -f%z {} + 2>/dev/null | awk '{s+=$1} END {print s+0}')
  fi

  echo -e "Peak RSS: ${GREEN}$(format_bytes "$ALLURE_GEN_RSS")${RESET}"
  echo -e "Wall time: ${GREEN}${ALLURE_GEN_WALL}s${RESET}"
fi

# ─── Pick higher of Allure collect vs generate for total ────────────────────
if [ "$ALLURE_GEN_RSS" -gt "$ALLURE_COLLECT_RSS" ] 2>/dev/null; then
  ALLURE_PEAK_RSS=$ALLURE_GEN_RSS
else
  ALLURE_PEAK_RSS=$ALLURE_COLLECT_RSS
fi

# ─── Results table ──────────────────────────────────────────────────────────
banner "Results"

ALLURE_GEN_RSS_DISPLAY=$([ "$ALLURE_GEN_RSS" -gt 0 ] 2>/dev/null && format_bytes "$ALLURE_GEN_RSS" || echo "${ALLURE_GEN_NOTE}")
ALLURE_GEN_WALL_DISPLAY=$([ "$ALLURE_GEN_WALL" != "N/A" ] && echo "${ALLURE_GEN_WALL}s" || echo "${ALLURE_GEN_NOTE}")
ALLURE_REPORT_SIZE_DISPLAY=$([ "$ALLURE_REPORT_SIZE" -gt 0 ] 2>/dev/null && format_bytes "$ALLURE_REPORT_SIZE" || echo "${ALLURE_GEN_NOTE}")

printf "${BOLD}%-28s %15s %15s${RESET}\n" "Metric" "Evoveo Smart Reporter" "Allure"
printf "%-28s %15s %15s\n"   "---" "---" "---"
printf "%-28s %15s %15s\n"   "Peak RSS (collection)" "$(format_bytes "$SMART_RSS")" "$(format_bytes "$ALLURE_COLLECT_RSS")"
printf "%-28s %15s %15s\n"   "Peak RSS (report gen)" "included" "$ALLURE_GEN_RSS_DISPLAY"
printf "%-28s %15s %15s\n"   "Peak RSS (highest)" "$(format_bytes "$SMART_RSS")" "$(format_bytes "$ALLURE_PEAK_RSS")"
printf "%-28s %15s %15s\n"   "Wall time (collection)" "${SMART_WALL}s" "${ALLURE_COLLECT_WALL}s"
printf "%-28s %15s %15s\n"   "Wall time (report gen)" "included" "$ALLURE_GEN_WALL_DISPLAY"
printf "%-28s %15s %15s\n"   "Report output size" "$(format_bytes "$SMART_REPORT_SIZE")" "$ALLURE_REPORT_SIZE_DISPLAY"

echo ""
echo -e "${CYAN}Note: Evoveo Smart Reporter generates the HTML report inline during the test run (pure Node.js).${RESET}"
echo -e "${CYAN}Allure requires a separate 'allure generate' step which needs a Java runtime.${RESET}"
if [ -z "$ALLURE_CMD" ]; then
  echo -e "${CYAN}Allure report generation was skipped (no JRE). Its peak RSS during generation is${RESET}"
  echo -e "${CYAN}typically 300-800MB+ with Java overhead — the phase that commonly causes OOM in CI.${RESET}"
fi
