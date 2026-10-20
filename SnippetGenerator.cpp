#include "SnippetGenerator.h"
#include "Tokenizer.h"
#include <sstream>
#include <algorithm>

using namespace std;

string SnippetGenerator::generate(const string& content, const string& query) const {
    
    Tokenizer tokenizer;
    vector<string> tokens = tokenizer.tokenize(query);
    istringstream stream(content);
    string line;
    while(getline(stream,line)){
        vector<string> linetokens = tokenizer.tokenize(line);
        for(const auto& str : linetokens){
            if(find(tokens.begin() , tokens.end(), str) != tokens.end()){
                return line;
            }
        }
    }
    return "";
}