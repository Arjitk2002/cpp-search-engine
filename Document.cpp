#include "Document.h"

Document::Document(int id,string title, string content){
    this->id = id;
    this->title = title;
    this->content = content;
}

int Document::getId() const {
        return id;
    }

string Document::getTitle() const{
    return title;
}

string Document::getContent() const{
    return content;
}