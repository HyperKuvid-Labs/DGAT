#include <bits/stdc++.h>
#include "json.hpp"
#include "httplib.h"

using namespace std;
using json = nlohmann::json;

vector<string> to_lines(const string& content, bool skip_empty = true) {
  vector<string> lines;
  istringstream stream(content);
  string line;

  while (getline(stream, line)) {
    if (skip_empty && line.empty()) {
      continue;
    }
    lines.push_back(line);
  }

  return lines;
}

int main(){
  // json request_payload = {
  //   {"model", "Qwen/Qwen3.5-2B"},
  //   {"messages", {
  //     {
  //       {"role", "user"},
  //       {"content", "Hello, how are you?"}
  //     }
  //   }}
  // };

  // string base_url = "http://localhost:8000/v1/chat/completions";

  // httplib::Client cli("localhost", 8000);

  // auto res = cli.Post(base_url, request_payload.dump(), "application/json");

  // if(res && res->status == 200){
  //   cout<<"response from vllm successful"<<endl;
  //   cout<<"response body: "<<res->body<<endl;
  // }else{
  //   cout<<"response from vllm failed"<<endl;
  //   if(res){
  //     cout<<"status code: "<<res->status<<endl;
  //     cout<<"response body: "<<res->body<<endl;
  //   }else{
  //     cout<<"error code: "<<res.error()<<endl;
  //   }
  // }

  // json response_json = json::parse(res->body);
  // cout<<"response json: "<<response_json["choices"][0]["message"]["reasoning"]<<endl;

  // system("tree .");

  system("tree . > tree_output.txt");

  // read the file tree_output.txt and store the content in a string variable
  ifstream tree_file("tree_output.txt");
  if (!tree_file.is_open()) {
    cerr << "Failed to open tree_output.txt" << endl;
    return 1;
  }

  string tree_content((istreambuf_iterator<char>(tree_file)), istreambuf_iterator<char>());
  tree_file.close();

  string tree_output = tree_content;
  cout<<"tree output: "<<endl<<tree_output<<endl;

  vector<string> lines = to_lines(tree_output);

  // print the lines
  cout<<"lines: "<<endl;
  for(const auto& line : lines){
    cout<<line<<endl;
  }

  return 0;
}