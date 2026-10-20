#include "Tokenizer.h"
#include <cctype>
using namespace std;
vector<string> Tokenizer::tokenize(const string& text) const {
    vector<string> result;
    string currentWord = "";
    for(auto ch : text){
        if(isalnum(static_cast<unsigned char> (ch))){
            currentWord += tolower(static_cast<unsigned char> (ch));
        }
        else{
            if (!currentWord.empty()) {
                result.push_back(currentWord);
                currentWord.clear();
    }
        }
    }
    if(!currentWord.empty())result.push_back(currentWord);
    return result;
}