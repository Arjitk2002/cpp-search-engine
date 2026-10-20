#pragma once
#include <string>

class SnippetGenerator{
    public:
    std::string generate(const std::string& content, const std::string& query) const;
};