#include "SearchEngine.h"
#include <unordered_set>
#include <algorithm>
#include <unordered_map>
#include <cmath>
using namespace std;

SearchEngine::SearchEngine(const InvertedIndex& sourceIndex)
    :index(sourceIndex){

    }


vector<pair<int,double>> SearchEngine::search(const string& query) const {
        const auto countOfDocs = index.getDocumentCount();
     unordered_map<int,double> score;
     const vector<string> queryTokens = tokens.tokenize(query);
     unordered_set<string> uniqueTokens(queryTokens.begin(), queryTokens.end());
        for(const auto& tk : uniqueTokens){
            const vector<int> matchingIds = index.getDocumentIds(tk);
            if(matchingIds.size() == 0)continue;
            const double idf = 1.0 + log((countOfDocs + 1.0) / (matchingIds.size() + 1.0));
            for(auto id : matchingIds){
                int fq = index.getTermfrequency(tk,id);
                score[id]+=fq * idf;
            }
        }
    vector<pair<int, double>> rankedResults(score.begin(), score.end());
        sort(rankedResults.begin(),rankedResults.end(),[](const auto& a, const auto& b){if(a.second == b.second){return a.first < b.first;}return a.second > b.second;});

        return rankedResults;
}   

