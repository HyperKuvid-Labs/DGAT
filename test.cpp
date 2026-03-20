#include <bits/stdc++.h>
#include "json.hpp"
#include "httplib.h"

using namespace std;
using json = nlohmann::json;

int main(){
  json request_payload = {
    {"model", "Qwen/Qwen3.5-2B"},
    {"messages", {
      {
        {"role", "user"},
        {"content", "Hello, how are you?"}
      }
    }}
  };

  string base_url = "http://localhost:8000/v1/chat/completions";

  httplib::Client cli("localhost", 8000);

  auto res = cli.Post(base_url, request_payload.dump(), "application/json");

  if(res && res->status == 200){
    cout<<"response from vllm successful"<<endl;
    cout<<"response body: "<<res->body<<endl;
  }else{
    cout<<"response from vllm failed"<<endl;
    if(res){
      cout<<"status code: "<<res->status<<endl;
      cout<<"response body: "<<res->body<<endl;
    }else{
      cout<<"error code: "<<res.error()<<endl;
    }
  }

  json response_json = json::parse(res->body);
  cout<<"response json: "<<response_json["choices"][0]["message"]["reasoning"]<<endl;

  return 0;
}