#include <bits/stdc++.h>
#include "json.hpp"
#include "httplib.h"
// #include <regex> just to check f regex was avavailable as a package. i think it will already included in the bits/stdc++.h

using namespace std;
using json = nlohmann::json;

struct TreeNode {
    string name;
    int version; // for version constrol, not has significance as of now
    string hash; // hash to onitor the version of the file
    string abs_path; // abs path from the file to the root of the project
    vector<TreeNode*> children;
    bool is_file; // this is to clssify whether the given one is file or a folder
    vector<json> error_traces; // this will be like [{"error": "file not found", "timestamp": "2024-06-01T12:00:00Z", "solution": "gnwodf"}, ]

    TreeNode(const string& abs_path, bool is_file)
        : version(0), abs_path(abs_path), is_file(is_file) {}

    TreeNode(const string& name)
        : name(name) {}
};

vector<string> dep_files_to_skip = {
  "requirements.txt", "requirements-dev.txt", "requirements-test.txt",
  "Pipfile", "Pipfile.lock", "pyproject.toml", "poetry.lock", "setup.py", "setup.cfg",
  "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
  "go.mod", "go.sum",
  "Cargo.toml", "Cargo.lock",
  "pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "gradle.properties",
  "composer.json", "composer.lock",
  "Gemfile", "Gemfile.lock",
  "mix.exs", "mix.lock",
  "pubspec.yaml", "pubspec.lock",
  "CMakeLists.txt", "conanfile.txt", "vcpkg.json",
  "rebar.config", "rebar.lock",
};

vector<string> languages = {
  "python", "cpp", "java", "javascript", "typescript", "go", "rust", "ruby", "php", "csharp", "dart", "kotlin", "swift", "scala", "elixir", "haskell", "clojure", "lua", "bash", "sh", "shell", "zsh", "powershell", "ps1", "pt"
};

vector<string> known_extensionless_filenames = {
  "Dockerfile",
    "Makefile",
    "GNUmakefile",
    "README",
    "LICENSE",
    "Procfile",
    "Rakefile",
    "Gemfile",
    "Pipfile",
    "Vagrantfile",
    "Jenkinsfile",
};

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

void lstrip(string& s, const string& delimiters = " \t\n\r\f\v") {
  if (s.empty() || delimiters.empty()) {
    return;
  }

  size_t start = s.find_first_not_of(delimiters);
  if (start == string::npos) {
    s.clear();
    return;
  }

  s.erase(0, start);
}

void rstrip(string& s, const string& delimiters = " \t\n\r\f\v") {
  if (s.empty() || delimiters.empty()) {
    return;
  }

  size_t end = s.find_last_not_of(delimiters);
  if (end == string::npos) {
    s.clear();
    return;
  }

  s.erase(end + 1);
}

void strip(string& s, const string& delimiters = " \t\n\r\f\v") {
  lstrip(s, delimiters);
  rstrip(s, delimiters);
}

bool startsWithCompare(const string& mainStr, const string& prefix) {
    return mainStr.compare(0, prefix.length(), prefix) == 0;
}

bool is_valid_file_node_name(string& file_name){
  if(file_name.empty()) return false;

  strip(file_name);

  if(find(known_extensionless_filenames.begin(), known_extensionless_filenames.end(), file_name) != known_extensionless_filenames.end()){
    return true;
  }

  if(file_name.size() > 1 && startsWithCompare(file_name, ".") && file_name.find(".", 1) == string::npos){
    return true;
  }

  size_t dot_pos = file_name.find_last_of('.');
  // split the file name into name and extension
  if(dot_pos != string::npos && dot_pos != file_name.size() - 1){
    string extension = file_name.substr(dot_pos + 1);
    if(extension.empty() || extension==".") return false;
  }

  return true;
}

void mark_file_and_dirs(TreeNode* node){
  if(node->children.empty()){
    node->is_file = is_valid_file_node_name(node->name);
    return;
  }

  for(auto child : node->children){
    mark_file_and_dirs(child);
  }

  node->is_file = false;
}

void print_tree(TreeNode* node, const string& prefix = "") {
    cout << prefix << (node->is_file ? "File: " : "Dir: ") << node->name << endl;
    for (size_t i = 0; i < node->children.size(); ++i) {
        print_tree(node->children[i], prefix + "    ");
    }
}

TreeNode* generate_tree(const string& tree_command_output, const string& project_name = "root"){
  regex tree_line_pattern(
    R"(^(?:[│|]\s*)*(?:├──\s*|└──\s*|\|--\s*|\+--\s*|`--\s*|\|___\s*)?([^│├└|+#\n]+?)(?:/)?(?:\s*#.*)?$)",
    regex::icase // Equivalent to re.IGNORECASE
  );

  regex tree_representation_pattern(
    R"(^[│├└─|`+\-\s]+)"
  );

  smatch matches;

  vector<string> lines = to_lines(tree_command_output);

  string root_name = project_name;
  int root_line_index = -1;

  for(auto& line : lines){
    if(line.empty()){
      continue;
    }

    regex_search(line, matches, tree_line_pattern);
    if(matches.size() > 1){
      string raw_name = matches[1].str();
      root_name = regex_replace(raw_name, tree_representation_pattern, "");
      strip(root_name);
      rstrip(root_name, "/");
    }else{
      strip(line);
      root_name = line;
      if(find(root_name.begin(), root_name.end(), '#') != root_name.end()){
        root_name = root_name.substr(0, root_name.find("#"));
        strip(root_name);
      }
      root_name = regex_replace(root_name, tree_representation_pattern, "");
      strip(root_name);
      rstrip(root_name, "/");
    }

    if(root_name != project_name){
      root_line_index++;
      break;
    }
  }

  replace(root_name.begin(), root_name.end(), ' ', '_');
  TreeNode* root = new TreeNode(root_name);

  vector<TreeNode*> tree_stack;

  for(int i=root_line_index+1; i<lines.size();i++){
    string line = lines[i];
    if(line.empty()) continue;

    int indent_level = 0;
    string temp_line = line;

    while(true){
      if(startsWithCompare(temp_line, "│   ") || startsWithCompare(temp_line, "|   ") || startsWithCompare(temp_line, "    ")){
        indent_level++;
        temp_line = temp_line.substr(4);
      }else if(startsWithCompare(temp_line, "| ") || startsWithCompare(temp_line, "│ ")){
        indent_level++;
        temp_line = temp_line.substr(2);
      }else if(startsWithCompare(temp_line, "\t")){
        indent_level++;
        temp_line = temp_line.substr(1);
      }else {
        break;
      }
    }

    smatch matches;
    regex_search(line, matches, tree_line_pattern);

    string file_name;

    if(matches.size()>1){
      string raw_name = matches[1].str();
      file_name = regex_replace(raw_name, tree_representation_pattern, "");
    }else{
      strip(line);
      if(find(line.begin(), line.end(), '#') != line.end()){
        line = line.substr(0, line.find("#"));
        strip(line);
      }
      file_name = regex_replace(line, tree_representation_pattern, "");
    }

    strip(file_name);

    rstrip(file_name, "/");
    replace(file_name.begin(), file_name.end(), ' ', '_');

    if(file_name.empty()){
      continue;
    }

    TreeNode* new_node = new TreeNode(file_name);
    new_node->is_file = is_valid_file_node_name(file_name);

    int parent_index = min(max(indent_level, 0), (int)tree_stack.size()-1);
    TreeNode* parent_node = parent_index >= 0 ? tree_stack[parent_index] : root;

    while(parent_index >= 0 && is_valid_file_node_name(parent_node->name)){
      parent_index -= 1;
      parent_node = tree_stack[parent_index];
    }

    parent_node->children.push_back(new_node);

    tree_stack.resize(parent_index + 1);
    if (!new_node->is_file) {
      tree_stack.push_back(new_node);
    }
  }

  mark_file_and_dirs(root);

  return root;
}

int main(){
  system("tree . > tree_output.txt");

  ifstream tree_file("tree_output.txt");
  if (!tree_file.is_open()) {
    cerr << "Failed to open tree_output.txt" << endl;
    return 1;
  }

  string tree_content((istreambuf_iterator<char>(tree_file)), istreambuf_iterator<char>());
  tree_file.close();

  TreeNode* root = generate_tree(tree_content, "DGAT_Project");

  print_tree(root);

  return 0;
}
