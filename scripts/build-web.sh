#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
compiler="${EMXX:-em++}"
mkdir -p docs
"$compiler" -std=c++17 -O2 -Wall -Wextra -I. \
  web/bridge.cpp Document.cpp Tokenizer.cpp \
  InvertedIndex.cpp SearchEngine.cpp SnippetGenerator.cpp \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createSearchEngine \
  -sENVIRONMENT=web,worker,node -sALLOW_MEMORY_GROWTH=1 \
  -sEXPORTED_FUNCTIONS='["_reset_collection","_add_document","_describe_collection","_search_documents"]' \
  -sEXPORTED_RUNTIME_METHODS='["ccall"]' \
  -o docs/engine.mjs
cp web/index.html web/styles.css web/app.js web/worker.js web/favicon.svg docs/
python3 - <<'PY'
from pathlib import Path
import json
docs = [{"title": f"data/{p.name}", "content": p.read_text()} for p in sorted(Path("data").glob("*.txt"))]
Path("docs/documents.json").write_text(json.dumps(docs, ensure_ascii=False))
PY
