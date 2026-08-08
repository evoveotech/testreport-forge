#!/usr/bin/env bash
#
# Links the canonical agent skills from .github/agents/ into every AI IDE's
# expected location so Claude, Copilot, Cursor, Windsurf, and Devin all pick
# them up automatically.
#
# Canonical source: .github/agents/<skill-name>/SKILL.md
# This script creates symlinks from the canonical source into each IDE's
# expected skills folder. Symlinks stay in sync with .github/agents/
# automatically — no re-run needed after updates.
#
# Usage:
#   bash scripts/setup-agents.sh             # link all IDEs (user + project)
#   bash scripts/setup-agents.sh --project   # link only project-local folders
#   bash scripts/setup-agents.sh --clean     # remove all created symlinks
#   bash scripts/setup-agents.sh --copy      # use copies instead of symlinks

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CANONICAL="$REPO_ROOT/.github/agents"

if [ ! -d "$CANONICAL" ]; then
  echo "ERROR: Canonical skills folder not found: $CANONICAL" >&2
  exit 1
fi

PROJECT_ONLY=false
CLEAN=false
COPY=false

for arg in "$@"; do
  case "$arg" in
    --project) PROJECT_ONLY=true ;;
    --clean)   CLEAN=true ;;
    --copy)    COPY=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

# Count skills
SKILL_COUNT=$(find "$CANONICAL" -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ')
echo "Found $SKILL_COUNT skills in $CANONICAL"

# ---------------------------------------------------------------------------
# Target locations.
# ---------------------------------------------------------------------------
USER_HOME="$HOME"
TARGETS=(
  "Claude (project)|.claude/skills|project"
  "Cursor (project)|.cursor/skills|project"
  "Windsurf (project)|.codeium/windsurf/skills|project"
  "Devin (project)|.devin/skills|project"
  "Claude (user)|$USER_HOME/.claude/skills|user"
  "Cursor (user)|$USER_HOME/.cursor/skills|user"
  "Windsurf (user)|$USER_HOME/.codeium/windsurf/skills|user"
  "Devin (user)|$USER_HOME/.devin/skills|user"
)

if $PROJECT_ONLY; then
  TARGETS=("${TARGETS[@]:0:4}")
fi

# ---------------------------------------------------------------------------
# Resolve target path (expand env vars, make absolute).
# ---------------------------------------------------------------------------
resolve_target() {
  local entry="$1"
  local rel_path
  rel_path="$(echo "$entry" | cut -d'|' -f2)"
  local scope
  scope="$(echo "$entry" | cut -d'|' -f3)"
  if [ "$scope" = "project" ]; then
    echo "$REPO_ROOT/$rel_path"
  else
    echo "$rel_path"
  fi
}

# ---------------------------------------------------------------------------
# Clean mode.
# ---------------------------------------------------------------------------
if $CLEAN; then
  echo "Cleaning existing links..."
  for entry in "${TARGETS[@]}"; do
    target_path="$(resolve_target "$entry")"
    [ ! -d "$target_path" ] && continue
    name_label="$(echo "$entry" | cut -d'|' -f1)"
    for skill_dir in "$target_path"/*/; do
      [ -L "${skill_dir%/}" ] || continue
      rm -f "${skill_dir%/}"
      echo "  removed $(basename "${skill_dir%/}") from $name_label"
    done
  done
  echo "Clean complete."
  exit 0
fi

# ---------------------------------------------------------------------------
# Link or copy.
# ---------------------------------------------------------------------------
LINK_TYPE="symlink"
$COPY && LINK_TYPE="copy"
echo "Mode: $LINK_TYPE"

CREATED=0
SKIPPED=0
ERRORS=0

for entry in "${TARGETS[@]}"; do
  name_label="$(echo "$entry" | cut -d'|' -f1)"
  target_path="$(resolve_target "$entry")"
  mkdir -p "$target_path"
  echo ""
  echo "[$name_label] -> $target_path"

  for skill_dir in "$CANONICAL"/*/; do
    skill_name="$(basename "$skill_dir")"
    link_path="$target_path/$skill_name"

    if [ -e "$link_path" ] || [ -L "$link_path" ]; then
      if [ -L "$link_path" ]; then
        rm -f "$link_path"
      else
        SKIPPED=$((SKIPPED + 1))
        continue
      fi
    fi

    if $COPY; then
      if cp -R "$skill_dir" "$link_path" 2>/dev/null; then
        CREATED=$((CREATED + 1))
      else
        ERRORS=$((ERRORS + 1))
        echo "  ERROR: $skill_name"
      fi
    else
      if ln -s "$skill_dir" "$link_path" 2>/dev/null; then
        CREATED=$((CREATED + 1))
      else
        ERRORS=$((ERRORS + 1))
        echo "  ERROR: $skill_name (ln -s failed — try --copy or run with sudo)"
      fi
    fi
  done
done

echo ""
echo "Done: created=$CREATED, skipped=$SKIPPED, errors=$ERRORS"
if ! $COPY; then
  echo "Symlinks stay in sync with .github/agents/ automatically."
else
  echo "Copies are a snapshot — re-run this script after updating .github/agents/."
fi
