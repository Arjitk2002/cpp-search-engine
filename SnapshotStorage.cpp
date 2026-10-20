#include "SnapshotStorage.h"
#include <iomanip>
#include <unordered_set>
#include <utility>
using namespace std;

bool SnapshotStorage::save(ostream& output, const vector<Document>& documents, const InvertedIndex& index)const {
    output<<"SEARCH_SNAPSHOT "<<1<<endl;
    output<<"DOCUMENTS "<< documents.size()<<endl;
    for(const auto& document : documents){
        output << document.getId() << ' '
       << quoted(document.getTitle()) << ' '
       << quoted(document.getContent()) << '\n';
    }
    return index.write(output);
}

  bool SnapshotStorage::load(istream& input,vector<Document>& documents,InvertedIndex& index) const{
        vector<Document> docTemp;
        unordered_set<int> idTemp;
        string label;
        int version;
        if(!(input >> label >> version) || label != "SEARCH_SNAPSHOT" || version != 1)return false;
        int docCount;
        if(!(input >>label >> docCount) || label != "DOCUMENTS" || docCount < 0 )return false;
        for (int i = 0; i < docCount; ++i) {
            int id;
            string title,content;
            if(!(input >> id >> quoted(title) >> quoted(content)) || id<=0 )return false;
            const auto& response = idTemp.insert(id);
            if(!response.second)return false;

            Document obj(id, title, content);
            docTemp.push_back(obj);

        }
        InvertedIndex indexTemp;

if (!indexTemp.read(input)) {
    return false;
}
if (indexTemp.getDocumentCount() != docTemp.size()) {
    return false;
}
    for(int id : idTemp){
        if(!indexTemp.containsDocument(id))return false;
    }
index = std::move(indexTemp);
documents.swap(docTemp);
return true;
}