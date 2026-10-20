#pragma once
#include <vector>
#include <ostream>
#include <istream>
#include "InvertedIndex.h"
#include "Document.h"

class SnapshotStorage{

    public:
    bool save(std::ostream& output, const std::vector<Document>& documents, const InvertedIndex& index) const;
    bool load(
    std::istream& input,
    std::vector<Document>& documents,
    InvertedIndex& index
) const;
};