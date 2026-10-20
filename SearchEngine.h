#pragma once
#include "InvertedIndex.h"
#include "Tokenizer.h"
#include <string>
#include <vector>
#include <utility>


class SearchEngine{
    private:
    const InvertedIndex& index;
    Tokenizer tokens;

    public:
    SearchEngine(const InvertedIndex& index);
    std::vector<std::pair<int, double>> search(const std::string& query) const;

};