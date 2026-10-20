#pragma once
#include <iostream>
#include <string>

using namespace std;
class Document{
    private:
    int id;
    string title;
    string content;

    public:

    Document(int id, string title, string content);

    int getId() const;
    string getTitle() const;
    string getContent() const;
};