#pragma once
#include <string>
#include <unordered_map>
#include <vector>
#include <unordered_set>
#include "Document.h"
#include <cstddef>
#include <istream>
#include <ostream>
class InvertedIndex{
    private:
    std::unordered_map<std::string , std::unordered_map<int,int>> index;
    std::unordered_set<int> indexedDocumentIds;
    public:
    void addDocument(const Document& document);
    int getTermfrequency(const std::string& term, int documentId) const;
    std::vector<int> getDocumentIds(const std::string& term) const;
    std::size_t getDocumentCount() const;
    bool write(std::ostream& output) const;
    bool read(std::istream& input);
    bool containsDocument(int documentId) const;
};