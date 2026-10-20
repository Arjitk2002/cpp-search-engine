#include "Document.h"
#include "InvertedIndex.h"
#include "SearchEngine.h"
#include "SnippetGenerator.h"
#include "SnapshotStorage.h"

#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

using namespace std;
namespace fs = std::filesystem;

// Replace content with the file's text, keeping line boundaries.
bool readFile(const string& path, string& content) {
    content.clear();

    ifstream file(path);
    if (!file.is_open()) {
        return false;
    }

    string line;
    while (getline(file, line)) {
        content += line;
        content += '\n';
    }

    return !file.bad();
}

int main(int argc, char* argv[]) {
    // 1. Accept either no option or --rebuild.
    if (argc > 2 || (argc == 2 && string(argv[1]) != "--rebuild")) {
        cerr << "Usage: " << argv[0] << " [--rebuild]\n";
        return 1;
    }

    const bool forceRebuild = argc == 2;
    const string directory = "data";
    const string snapshotPath = "storage/index.snapshot";

    // Both startup paths populate these same objects.
    vector<Document> documents;
    InvertedIndex index;
    SnapshotStorage storage;

    try {
        if (!forceRebuild && fs::exists(snapshotPath)) {
            // 2A. Restore documents and index without accessing data/.
            ifstream input(snapshotPath);
            if (!input || !storage.load(input, documents, index)) {
                cerr << "Could not load the snapshot.\n"
                     << "Run ./search_engine --rebuild to recreate it from data/.\n";
                return 1;
            }

            cout << "Loaded snapshot. Documents: " << documents.size() << '\n';
        } else {
            // 2B. Build from source when requested or no snapshot exists.
            if (!fs::is_directory(directory)) {
                cerr << "Invalid input directory: " << directory << '\n';
                return 1;
            }

            vector<string> files;
            for (const auto& entry : fs::directory_iterator(directory)) {
                if (entry.is_regular_file() && entry.path().extension() == ".txt") {
                    files.push_back(entry.path().string());
                }
            }

            if (files.empty()) {
                cout << "No .txt files found in " << directory << '\n';
            }

            // Load readable documents and assign their IDs.
            int nextDocumentId = 1;
            string content;

            for (const string& path : files) {
                if (!readFile(path, content)) {
                    cerr << "Could not read file: " << path << '\n';
                    continue;
                }

                Document document(nextDocumentId++, path, content);
                documents.push_back(document);
            }

            for (const Document& document : documents) {
                index.addDocument(document);
            }

            // Save the complete snapshot for future launches.
            fs::create_directories("storage");

            ofstream output(snapshotPath);
            if (!output || !storage.save(output, documents, index)) {
                cerr << "Could not save the full snapshot.\n";
                return 1;
            }

            output.close();
            if (!output) {
                cerr << "Could not finalize the snapshot.\n";
                return 1;
            }

            cout << "Built and saved snapshot. Documents: "
                 << documents.size() << '\n';
        }
    } catch (const fs::filesystem_error& error) {
        cerr << "Filesystem error: " << error.what() << '\n';
        return 1;
    }

    // 3. Construct the engine after startup has populated the index.
    SearchEngine engine(index);
    SnippetGenerator snippets;

    // 4. Read queries and display ranked results with matching text.
    while (true) {
        cout << "\nSearch (:quit to exit): ";
        string query;

        if (!getline(cin, query) || query == ":quit") {
            break;
        }

        const auto rankedResults = engine.search(query);

        if (rankedResults.empty()) {
            cout << "No matching documents. Enter again.\n";
            continue;
        }

        for (const auto& result : rankedResults) {
            const int documentId = result.first;
            const double totalScore = result.second;

            for (const Document& document : documents) {
                if (document.getId() == documentId) {
                    cout << "ID: " << documentId
                         << " | File: " << document.getTitle()
                         << " | Score: " << totalScore << '\n';

                    const string snippet =
                        snippets.generate(document.getContent(), query);

                    if (!snippet.empty()) {
                        cout << " | Snippet: " << snippet << '\n';
                    }

                    break;
                }
            }
        }
    }

    return 0;
}