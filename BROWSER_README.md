# Publish Folio on GitHub Pages

This package adds a browser interface to your existing cpp-search-engine
repository. It does not contain replacements for your original C++ source files.

## What is included

- docs/: compiled browser application, including the original C++ engine as WebAssembly.
- web/: readable HTML/CSS/JavaScript and the thin C++ transport adapter.
- scripts/: rebuild command and native/WebAssembly verification tools.

Keep docs/.nojekyll. It is intentionally empty and hidden on macOS.
The compiled files are already included; Emscripten is only needed if you rebuild
engine.wasm after changing the C++ engine or its adapter.

## Publish from your Mac

1. Unzip this package.
2. Copy docs/, web/, scripts/, and this BROWSER_README.md file into your existing
   cpp-search-engine project folder. They should sit beside main.cpp,
   SearchEngine.cpp, and your other C++ source files.
   If any of these folders already exist in your project, compare and merge
   their contents rather than replacing unrelated files.
3. Open that project folder in VS Code, then open Terminal > New Terminal.
4. Run git status and check that the new browser files are listed.
5. Run:

   git add docs web scripts BROWSER_README.md
   git commit -m "Add browser demo for GitHub Pages"
   git push origin main

6. In your own signed-in browser, open:
   https://github.com/Arjitk2002/cpp-search-engine/settings/pages
7. Under Build and deployment, choose Deploy from a branch as the Source.
8. Choose branch main and folder /docs, then click Save.
9. Wait for the Pages build to finish. The repository's Actions tab shows the
   build status. When the Pages settings page shows Visit site, open it.

Expected default address AFTER GitHub reports a successful deployment:
https://arjitk2002.github.io/cpp-search-engine/

This package has been prepared and tested locally. It has not yet been uploaded
or enabled on GitHub Pages. Pages will be a public demo, without ChatGPT sign-in.

## Check your live demo

- Search binary search: test.txt should score 3.863, notes.txt 2.575.
- Select notes.txt to inspect the original document text.
- Open Score breakdown to see frequency multiplied by IDF.
- Search an absent word: the page should show the no-results state.
- Add a small UTF-8 .txt file, then search for a word in it.
- Refresh to restore the original three-file sample collection.

Imported files are processed inside the browser and are not uploaded.

## Build or verify later

After installing and activating Emscripten 4.0.20:

    bash scripts/build-web.sh

Or set EMXX to the absolute path to em++.

With g++, Python 3 and Node available:

    python3 scripts/verify.py

The test compares native C++ and WebAssembly results. The public package passed
these checks before it was prepared. The original engine sources remain
unchanged. The interface calls the original C++ Tokenizer, InvertedIndex,
SearchEngine, and SnippetGenerator through web/bridge.cpp.
