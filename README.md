# C++ Document Search Engine

A C++17 command-line search engine for local text files. It builds an inverted index, ranks multiword queries with TF-IDF, displays matching text, and restores its document collection from a saved snapshot.

Built to explore object-oriented design, STL containers, file handling, information retrieval, and serialization.

## Features

- Scan a directory for regular files with the `.txt` extension.
- Normalize document text and queries into lowercase alphanumeric tokens.
- Search multiple words using OR matching: any query word can produce a match.
- Deduplicate query words so repetition does not increase their weight.
- Rank matches with raw term frequency and smoothed inverse document frequency.
- Break equal-score ties by ascending document ID.
- Display document IDs, source paths, scores, and the first matching line.
- Save and restore IDs, titles, full document contents, and index entries together.
- Load a snapshot without requiring the original source directory.
- Rebuild explicitly when source files change.
- Validate snapshot headers, version, counts, duplicate IDs, and ID consistency.

## Requirements

- A C++17-compatible compiler and standard library with `std::filesystem` support.
- A terminal.
- No third-party libraries.

Development uses Clang on macOS. A compatible GCC installation can also compile the same source files.

## Build and run

Run commands from the project root.

### Prepare input files

Create a `data` directory and add one or more `.txt` files:

```bash
mkdir -p data
```

For example, create `data/notes.txt` containing:

```text
Binary search works on sorted data.
Graphs contain vertices and edges.
I practice DSA using C++.
```

### Compile

```bash
clang++ -std=c++17 -Wall -Wextra -pedantic \
    main.cpp Document.cpp Tokenizer.cpp InvertedIndex.cpp \
    SearchEngine.cpp SnippetGenerator.cpp SnapshotStorage.cpp \
    -o search_engine
```

Use `g++` instead of `clang++` if using GCC.

### Build the collection

```bash
./search_engine --rebuild
```

This reads `data`, builds the index, and writes `storage/index.snapshot`.

### Search

Enter one or more words at the prompt. Enter `:quit` to exit, or end terminal input with Ctrl+D.

```text
Search (:quit to exit): BINARY search
ID: 1 | File: data/notes.txt | Score: 2
 | Snippet: Binary search works on sorted data.

Search (:quit to exit): cartoon
No matching documents. Enter again.

Search (:quit to exit): :quit
```

The example score assumes the collection contains only the sample document above. IDs and scores depend on the collection.

## Startup behavior

| Command or condition | Behavior |
| --- | --- |
| `./search_engine`, valid snapshot exists | Restore documents and index; skip source scanning |
| `./search_engine`, no snapshot exists | Build from `data` and save a snapshot |
| `./search_engine --rebuild` | Build from current source files and replace the snapshot |
| Existing snapshot cannot be loaded | Report an error and suggest rebuilding |
| Unsupported argument | Print usage and exit |

Source changes are incorporated only after a rebuild. Paths are relative to the current working directory.

The `storage` directory contains generated data and does not need to be committed to Git.

## Search and ranking

The inverted index stores:

```text
word -> {document ID -> occurrence count}
```

Documents and queries use the same tokenizer:

```text
"Binary SEARCH, binary!" -> ["binary", "search", "binary"]
```

Query tokens are deduplicated before scoring. For each matching document:

```text
IDF(term) = 1 + ln((N + 1) / (df(term) + 1))

score(document, query) =
    sum of frequency(term, document) * IDF(term)
    over distinct query terms
```

- `N`: total indexed documents, including empty documents.
- `df(term)`: number of documents containing the term.
- `ln`: natural logarithm.

Rarer terms receive more weight per occurrence. Results are ordered by descending score, then ascending document ID. Raw frequencies are used without document-length normalization.

## Components

| Files | Responsibility |
| --- | --- |
| `Document.h`, `Document.cpp` | Store a document's ID, title, and content |
| `Tokenizer.h`, `Tokenizer.cpp` | Normalize text and split it into tokens |
| `InvertedIndex.h`, `InvertedIndex.cpp` | Store frequencies, retrieve matches, and serialize index data |
| `SearchEngine.h`, `SearchEngine.cpp` | Normalize queries, accumulate TF-IDF scores, and rank results |
| `SnippetGenerator.h`, `SnippetGenerator.cpp` | Return the first original line containing any query token |
| `SnapshotStorage.h`, `SnapshotStorage.cpp` | Save and load complete document collections and indexes |
| `main.cpp` | Handle startup, source loading, and terminal interaction |

`SearchEngine` holds a read-only reference to the index. The index remains alive while the engine is used.

## Snapshot format

The text format begins with `SEARCH_SNAPSHOT 1`, followed by:

1. A `DOCUMENTS` section with each document's ID, quoted title, and quoted content.
2. A `DOC_IDS` section preserving all indexed IDs, including empty documents.
3. A `TERMS` section containing words and their document-frequency entries.

Titles and contents use `std::quoted` to preserve spaces, quotes, backslashes, and multiline content.

Loading parses into temporary containers and validates the snapshot before committing the restored state. Saved content allows previews without reopening source files. Displayed source paths describe the saved collection; they need not still exist.

## Manual verification

| Check | Expected behavior |
| --- | --- |
| Change query capitalization | Same matches and scores |
| Repeat a word in a query | Same scores as the deduplicated query |
| Search a missing word | No matching documents |
| Enter empty or punctuation-only input | No matching documents |
| Search an absent word together with a present word | Documents matching the present word are returned |
| Produce equal-scoring results | Smaller document ID appears first |
| Save, quit, and launch normally | Snapshot loads with the same scores and previews |
| Temporarily rename `data` after saving, then launch normally | Search works from the snapshot |
| Add a source file and run `--rebuild` | New content becomes searchable |
| Load an invalid snapshot | Loading fails instead of accepting partial state |
| Use an unsupported command-line argument | Usage is printed |

Restore renamed folders after testing. These are manual verification procedures; the project does not currently include an automated test suite.

## Current limitations

- Scanning is nonrecursive and accepts the lowercase `.txt` extension.
- Tokenization targets English letters and digits; it is not Unicode-aware.
- Punctuation separates tokens: `C++` becomes `c` and `graph-based` becomes `graph` and `based`.
- Phrase, Boolean, stemming, and fuzzy search are not implemented.
- Raw term frequency can favor longer documents.
- Previews return a full matching line without a length limit or highlighting.
- Documents and the index are held in memory.
- Source updates require `--rebuild`; files are not monitored automatically.
- IDs are preserved in a snapshot but may change after rebuilding.
