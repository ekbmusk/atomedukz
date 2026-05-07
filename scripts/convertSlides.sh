#!/usr/bin/env bash
# convertSlides.sh — Convert all .pptx files in the content source folder to PNG slides.
#
# For each "№ N тақырып.../<file>.pptx" found, produces:
#   slides_out/topic-<N>/slide-001.png, slide-002.png, ...
#
# Requires: libreoffice (Cask), poppler (`brew install poppler` for `pdftoppm`).
#
# Usage:
#   ./scripts/convertSlides.sh                            # uses default content dir
#   CONTENT_DIR="path/to/Атом..." ./scripts/convertSlides.sh
#   ./scripts/convertSlides.sh --dpi 200                  # higher resolution

set -euo pipefail

CONTENT_DIR="${CONTENT_DIR:-Атом Электронный кітап}"
OUT_DIR="${OUT_DIR:-slides_out}"
DPI="${DPI:-150}"

# Parse simple flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dpi) DPI="$2"; shift 2 ;;
    --content) CONTENT_DIR="$2"; shift 2 ;;
    --out) OUT_DIR="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# Locate libreoffice binary (macOS Cask path or PATH)
SOFFICE=""
if command -v soffice >/dev/null 2>&1; then
  SOFFICE="$(command -v soffice)"
elif [[ -x "/Applications/LibreOffice.app/Contents/MacOS/soffice" ]]; then
  SOFFICE="/Applications/LibreOffice.app/Contents/MacOS/soffice"
else
  echo "ERROR: LibreOffice not found. Install with: brew install --cask libreoffice" >&2
  exit 1
fi

if ! command -v pdftoppm >/dev/null 2>&1; then
  echo "ERROR: pdftoppm not found. Install with: brew install poppler" >&2
  exit 1
fi

if [[ ! -d "$CONTENT_DIR" ]]; then
  echo "ERROR: Content dir not found: $CONTENT_DIR" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
TMP_PDF_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_PDF_DIR"' EXIT

shopt -s nullglob

# Iterate over topic folders
for topic_dir in "$CONTENT_DIR"/№*; do
  [[ -d "$topic_dir" ]] || continue
  topic_name="$(basename "$topic_dir")"

  # Extract topic number from prefix like "№ 12 тақырып..." → 12
  if [[ "$topic_name" =~ №[[:space:]]*([0-9]+) ]]; then
    topic_num="${BASH_REMATCH[1]}"
  else
    echo "Skip (no № N prefix): $topic_name" >&2
    continue
  fi

  topic_out=$(printf "%s/topic-%02d" "$OUT_DIR" "$topic_num")

  # Prefer .pptx; fall back to a pre-existing .pdf lecture if no pptx exists.
  pptx_file="$(find "$topic_dir" -type f -iname "*.pptx" | sort | head -1)"
  pdf_source=""

  if [[ -n "$pptx_file" ]]; then
    pdf_source="pptx"
    echo "→ topic-$topic_num: $(basename "$pptx_file")"
  else
    # Look for an existing PDF (skip files with "есеп"/"зертхана"/"сілтеме" — those are tasks, not lecture)
    pdf_file_existing="$(find "$topic_dir" -type f -iname "*.pdf" \
      ! -iname "*есеп*" ! -iname "*зертхана*" ! -iname "*сілтеме*" \
      | sort | head -1)"
    if [[ -n "$pdf_file_existing" ]]; then
      pdf_source="pdf"
      echo "→ topic-$topic_num: $(basename "$pdf_file_existing") [PDF source]"
    else
      echo "  topic-$topic_num: no .pptx or lecture .pdf, skipping"
      continue
    fi
  fi

  mkdir -p "$topic_out"

  if [[ "$pdf_source" == "pptx" ]]; then
    # 1) pptx → pdf via LibreOffice
    "$SOFFICE" --headless --convert-to pdf --outdir "$TMP_PDF_DIR" "$pptx_file" >/dev/null
    pdf_file="$TMP_PDF_DIR/$(basename "${pptx_file%.*}").pdf"
  else
    pdf_file="$pdf_file_existing"
  fi

  if [[ ! -f "$pdf_file" ]]; then
    echo "  ERROR: PDF not found for topic-$topic_num" >&2
    continue
  fi

  # 2) pdf → png slides via pdftoppm
  pdftoppm -png -r "$DPI" "$pdf_file" "$topic_out/slide" -progress 2>/dev/null

  # Rename pdftoppm output (slide-1.png / slide-08.png → slide-001.png) for stable sort.
  # Force base 10 with 10# prefix, otherwise bash treats "08"/"09" as octal and errors.
  for f in "$topic_out"/slide-*.png; do
    [[ -f "$f" ]] || continue
    base="$(basename "$f")"
    num="${base#slide-}"
    num="${num%.png}"
    new=$(printf "slide-%03d.png" "$((10#$num))")
    [[ "$base" != "$new" ]] && mv "$f" "$topic_out/$new"
  done

  count=$(find "$topic_out" -name "slide-*.png" | wc -l | tr -d ' ')
  echo "  ✓ $count slides → $topic_out"
done

echo ""
echo "Done. Output: $OUT_DIR"
echo "Next: upload to Supabase Storage 'lecture-slides' bucket via scripts/importContent.ts"
