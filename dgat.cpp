#include <bits/stdc++.h>
#include "json.hpp"
#include "httplib.h"

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

bool is_tree_summary_line(const string& line) {
  string trimmed = line;
  strip(trimmed);
  if (trimmed.empty()) {
    return false;
  }

  static const regex summary_line_pattern(
    R"(^\d+\s+directories?,\s+\d+\s+files?$)",
    regex::icase
  );

  return regex_match(trimmed, summary_line_pattern);
}

void mark_file_and_dirs(TreeNode* node){
  if(node->children.empty()){
    node->is_file = true;
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
  string content = tree_command_output;
  strip(content);
  size_t fence_pos;
  while ((fence_pos = content.find("```") ) != string::npos) {
    content.erase(fence_pos, 3);
  }
  strip(content);

  vector<string> lines = to_lines(content, false);
  vector<TreeNode*> stack;
  TreeNode* root = new TreeNode(project_name);

  for (const string& raw_line : lines) {
    string line = raw_line;
    size_t nbsp_pos;
    while ((nbsp_pos = line.find("\xC2\xA0")) != string::npos) {
      line.replace(nbsp_pos, 2, " ");
    }

    if (line.empty()) {
      continue;
    }

    string trimmed_line = line;
    strip(trimmed_line);
    if (trimmed_line.empty()) {
      continue;
    }

    int indent = 0;
    string temp_line = line;
    while (
      startsWithCompare(temp_line, "│   ") ||
      startsWithCompare(temp_line, "    ") ||
      startsWithCompare(temp_line, "│ ")
    ) {
      if (temp_line.size() < 4) {
        break;
      }
      temp_line = temp_line.substr(4);
      indent += 1;
    }

    string name = trimmed_line;
    size_t hash_pos = name.find('#');
    if (hash_pos != string::npos) {
      name = name.substr(0, hash_pos);
      strip(name);
    }

    size_t pos;
    while ((pos = name.find("│")) != string::npos) {
      name.erase(pos, string("│").size());
    }
    while ((pos = name.find("├──")) != string::npos) {
      name.erase(pos, string("├──").size());
    }
    while ((pos = name.find("└──")) != string::npos) {
      name.erase(pos, string("└──").size());
    }
    strip(name);

    if (name.empty() || name == project_name || is_tree_summary_line(name)) {
      continue;
    }

    TreeNode* node = new TreeNode(name);
    node->is_file = false;

    if (indent == 0) {
      root->children.push_back(node);
      stack.clear();
      stack.push_back(root);
      stack.push_back(node);
    } else {
      while ((int)stack.size() > indent + 1) {
        stack.pop_back();
      }

      if (!stack.empty()) {
        stack.back()->children.push_back(node);
      }
      stack.push_back(node);
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

  system("rm tree_output.txt");

  TreeNode* root = generate_tree(tree_content, "DGAT_Project");

  print_tree(root);

  return 0;
}