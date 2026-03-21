#include <bits/stdc++.h>
#include <filesystem>
#include "json.hpp"
#include "httplib.h"

using namespace std;
using json = nlohmann::json;
namespace fs = std::filesystem;

struct TreeNode {
    string name;
  int version; // id i use while writing dot nodes
  string hash; // can be used later to track file version changes
  string abs_path; // full path in system
  string rel_path; // path from project root (this one is key)
  vector<unique_ptr<TreeNode>> children;
  bool is_file; // true = file, false = folder
  vector<json> error_traces; // like [{"error": "...", "timestamp": "...", "solution": "..."}]
  string description; // extra file context if needed later

    TreeNode(const string& name,
             const string& abs_path,
             const string& rel_path,
             bool is_file)
        : name(name),
          version(0),
          abs_path(abs_path),
          rel_path(rel_path),
          is_file(is_file) {}
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

// quick heuristic helper, keeping it for later use
bool is_probably_file(const string& name) {
  if (find(known_extensionless_filenames.begin(),
           known_extensionless_filenames.end(),
           name) != known_extensionless_filenames.end()) {
    return true;
  }

  return name.find('.') != string::npos;
}

// core tree build from filesystem only (no parsing nonsense)
unique_ptr<TreeNode> build_tree(const fs::path& current_path,
                const fs::path& root_path) {

  string fname = current_path.filename().string();
  if (fname == ".git") {
    return nullptr;
  }
  if (find(dep_files_to_skip.begin(), dep_files_to_skip.end(), fname) != dep_files_to_skip.end()) {
    return nullptr;
  }

  string name = (current_path == root_path)
    ? fs::absolute(root_path).filename().string()
    : current_path.filename().string();
  if (name.empty()) name = "root";

    string abs_path = fs::absolute(current_path).string();
    string rel_path = fs::relative(current_path, root_path).string();
  if (rel_path.empty()) rel_path = ".";

    bool is_file = fs::is_regular_file(current_path);

  auto node = make_unique<TreeNode>(name, abs_path, rel_path, is_file);

  // symlink loop guard (avoid recursive trap)
  if (fs::is_symlink(current_path)) return node;

  // if folder, recurse children in stable order
    if (fs::is_directory(current_path)) {
    vector<fs::directory_entry> entries;
    for (const auto& entry : fs::directory_iterator(current_path)) {
      entries.push_back(entry);
    }

    sort(entries.begin(), entries.end(),
       [](const auto& a, const auto& b) {
         return a.path().filename().string() < b.path().filename().string();
       });

    for (const auto& entry : entries) {
      auto child = build_tree(entry.path(), root_path);
      if (child) node->children.push_back(move(child));
        }
        node->is_file = false;
    }

    return node;
}

void print_tree(TreeNode* node) {
    if (!node) return;

    if (!node->children.empty()) {
        cout << node->name << " -> ";
        for (size_t i = 0; i < node->children.size(); i++) {
            cout << node->children[i]->name;
            if (i != node->children.size() - 1) cout << ", ";
        }
        cout << endl;
    }

    for (const auto& child : node->children) {
      print_tree(child.get());
    }
}

string escape_dot_label(const string& input) {
  string escaped;
  escaped.reserve(input.size());

  for (char c : input) {
    if (c == '"' || c == '\\') {
      escaped.push_back('\\');
    }
    escaped.push_back(c);
  }

  return escaped;
}

void write_dot_nodes_and_edges(TreeNode* node, ofstream& out, int& next_id) {
  if (!node) return;

  int current_id = next_id++;
  node->version = current_id;

  string shape = node->is_file ? "note" : "folder";

  // keep rel_path in label so mapping back is super easy
  out << "  n" << current_id
      << " [label=\"" << escape_dot_label(node->name + "\\n" + node->rel_path)
      << "\", shape=" << shape << "];\n";

  for (const auto& child : node->children) {
    write_dot_nodes_and_edges(child.get(), out, next_id);
    out << "  n" << current_id << " -> n" << child->version << ";\n";
  }
}

bool export_tree_as_dot(TreeNode* root, const string& output_path) {
  ofstream out(output_path);
  if (!out.is_open()) return false;

  out << "digraph DGATTree {\n";
  out << "  rankdir=TB;\n";
  out << "  node [fontname=\"Helvetica\"];\n";

  int next_id = 0;
  write_dot_nodes_and_edges(root, out, next_id);

  out << "}\n";
  return true;
}

int main(){
  fs::path root_path = "."; // set this if you want a different project root

  auto root = build_tree(root_path, root_path);
  if (!root) {
    cerr << "Failed to build tree from root path." << endl;
    return 1;
  }

  const string dot_file = "tree_visualization.dot";
  if (!export_tree_as_dot(root.get(), dot_file)) {
    cerr << "Failed to write visualization file: " << dot_file << endl;
    return 1;
  }

  cout << "Tree visualization written to: " << dot_file << endl;

  int dot_available = system("command -v dot > /dev/null 2>&1");
  if (dot_available == 0) {
    const string png_file = "tree_visualization.png";
    string render_cmd = "dot -Tpng " + dot_file + " -o " + png_file;
    if (system(render_cmd.c_str()) == 0) {
      cout << "PNG visualization written to: " << png_file << endl;
    } else {
      cerr << "Failed to render PNG from DOT file" << endl;
    }
  } else {
    cout << "Graphviz not found; install 'dot' to render PNG from the DOT file." << endl;
  }

  return 0;
}