#include "InvertedIndex.h"
#include "Tokenizer.h"
#include <algorithm>
using namespace std;

void InvertedIndex::addDocument(const Document& document){
    Tokenizer tokens;
    vector<string> res =   tokens.tokenize(document.getContent());
    int id = document.getId();
    for(auto token : res){
        index[token][id]++;
    }
    indexedDocumentIds.insert(id);

}

int InvertedIndex::getTermfrequency(const string& term, int documentId) const {
    auto termInIndex = index.find(term);
    if (termInIndex == index.end()) {
    return 0;
    }
    auto freq = termInIndex->second.find(documentId);
    
    if(freq != termInIndex->second.end()){
        return freq->second;
    }
    return 0;
}

vector<int> InvertedIndex::getDocumentIds(const string& term) const{
    vector<int> ans;
    auto found = index.find(term);
    if(found == index.end())return ans;
    for(auto &itr : found->second)ans.push_back(itr.first);
    sort(ans.begin(),ans.end());
    return ans;
}

size_t InvertedIndex::getDocumentCount() const {
    return indexedDocumentIds.size();
}

bool InvertedIndex::write(ostream& output) const {
    output<<"DOC_IDS "<<indexedDocumentIds.size()<<endl;
    for(const auto& id : indexedDocumentIds)output<<id<<" ";
    output<<endl<<"TERMS "<<index.size()<<endl;
    for(const auto& itr : index){
        output<<itr.first<<" "<<itr.second.size()<<endl;
        for(const auto& itr2 : itr.second){
            output<<itr2.first<<" "<<itr2.second<<endl;
        }
    }
    return static_cast<bool>(output);
}

bool InvertedIndex::read(istream& input) {
    unordered_map<string , unordered_map<int,int>> indexTemp;
    unordered_set<int> indexedDocumentIdsTemp;

    string label;
    int documentCount;
    if(!(input >> label >> documentCount) || label != "DOC_IDS" || documentCount < 0)return false;

    for(int i=0;i<documentCount;i++){

        int d;
        if(!(input >> d))return false;
        if(d <= 0) return false;
        const auto res = indexedDocumentIdsTemp.insert(d);
        if(!res.second)return false;
    }
    int termCount;
    if(!(input >> label >> termCount)|| label != "TERMS" || termCount < 0) return false;
    for(int i=0;i<termCount;i++){
        string word;
        int entryCount;
        if(!(input >> word >> entryCount))return false;
        if(entryCount <=0 || entryCount > documentCount) return false;
        if(indexTemp.find(word) != indexTemp.end())return false;
        for(int k = 0;k< entryCount;k++){
            int documentId,frequency;
            if(!(input >> documentId >> frequency))return false;
            if(frequency <=0)return false;
            if(indexedDocumentIdsTemp.find(documentId) == indexedDocumentIdsTemp.end())return false;
            const auto result = indexTemp[word].insert({documentId,frequency});
            if(!result.second)return false;
        }
    }
    index.swap(indexTemp);
    indexedDocumentIds.swap(indexedDocumentIdsTemp);
    return true;

}

bool InvertedIndex::containsDocument(int documentId) const {
    return indexedDocumentIds.find(documentId) != indexedDocumentIds.end();
}

