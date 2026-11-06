// Thin transport adapter. Tokenization, indexing, ranking and snippets use the
// original engine classes, compiled unchanged for native and WebAssembly builds.
#include "Document.h"
#include "InvertedIndex.h"
#include "SearchEngine.h"
#include "SnippetGenerator.h"
#include "Tokenizer.h"
#include <cmath>
#include <iomanip>
#include <sstream>
#include <string>
#include <unordered_set>
#include <vector>

namespace {
std::vector<Document> documents;
InvertedIndex searchIndex;
std::string response;

std::string quote(const std::string& value) {
    std::ostringstream out;
    out << '"';
    for (unsigned char c : value) {
        switch (c) {
            case '"': out << "\\\""; break;
            case '\\': out << "\\\\"; break;
            case '\n': out << "\\n"; break;
            case '\r': out << "\\r"; break;
            case '\t': out << "\\t"; break;
            default:
                if (c < 0x20) out << "\\u" << std::hex << std::setw(4)
                                 << std::setfill('0') << int(c) << std::dec;
                else out << c;
        }
    }
    out << '"';
    return out.str();
}
}

extern "C" {
void reset_collection() {
    documents.clear();
    searchIndex = InvertedIndex{};
}

int add_document(const char* title, const char* content) {
    int id = static_cast<int>(documents.size()) + 1;
    documents.emplace_back(id, title, content);
    searchIndex.addDocument(documents.back());
    return id;
}

const char* describe_collection() {
    Tokenizer tokenizer;
    std::unordered_set<std::string> unique;
    std::size_t wordCount = 0;
    std::ostringstream out;
    out << "{\"documents\":[";
    for (std::size_t i = 0; i < documents.size(); ++i) {
        const auto& doc = documents[i];
        auto tokens = tokenizer.tokenize(doc.getContent());
        unique.insert(tokens.begin(), tokens.end());
        wordCount += tokens.size();
        if (i) out << ',';
        out << "{\"id\":" << doc.getId() << ",\"title\":" << quote(doc.getTitle())
            << ",\"content\":" << quote(doc.getContent())
            << ",\"wordCount\":" << tokens.size() << '}';
    }
    out << "],\"uniqueTerms\":" << unique.size() << ",\"wordCount\":" << wordCount << '}';
    response = out.str();
    return response.c_str();
}

const char* search_documents(const char* queryText) {
    const std::string query(queryText);
    Tokenizer tokenizer;
    std::unordered_set<std::string> seen;
    std::vector<std::string> terms;
    for (const auto& term : tokenizer.tokenize(query))
        if (seen.insert(term).second) terms.push_back(term);
    SearchEngine engine(searchIndex);
    SnippetGenerator snippets;
    const auto ranked = engine.search(query);
    std::ostringstream out;
    out << std::setprecision(17) << "{\"terms\":[";
    for (std::size_t i = 0; i < terms.size(); ++i) {
        if (i) out << ',';
        out << quote(terms[i]);
    }
    out << "],\"results\":[";
    for (std::size_t i = 0; i < ranked.size(); ++i) {
        if (i) out << ',';
        const auto [id, score] = ranked[i];
        const auto& doc = documents.at(static_cast<std::size_t>(id - 1));
        out << "{\"id\":" << id << ",\"score\":" << score
            << ",\"snippet\":" << quote(snippets.generate(doc.getContent(), query))
            << ",\"breakdown\":[";
        for (std::size_t t = 0; t < terms.size(); ++t) {
            if (t) out << ',';
            const auto& term = terms[t];
            const auto df = searchIndex.getDocumentIds(term).size();
            const double idf = 1.0 + std::log((searchIndex.getDocumentCount() + 1.0) / (df + 1.0));
            out << "{\"term\":" << quote(term)
                << ",\"frequency\":" << searchIndex.getTermfrequency(term, id)
                << ",\"documentFrequency\":" << df << ",\"idf\":" << idf << '}';
        }
        out << "]}";
    }
    out << "]}";
    response = out.str();
    return response.c_str();
}
}
