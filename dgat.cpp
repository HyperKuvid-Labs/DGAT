#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <map>
#include <set>
#include <unordered_map>
#include <unordered_set>
#include <algorithm>
#include <cctype>
#include <regex>
#include <filesystem>
#include <thread>
#include <mutex>
#include <atomic>
#include <functional>
#include <future>
#include <queue>
#include <chrono>
#include <memory>
#include <limits>
#include <optional>
#include <variant>
#include "inja.hpp"
#include "json.hpp"
#include "httplib.h"
#include "xxhash.h"

using namespace std;
using json = nlohmann::json;
namespace fs = std::filesystem;

class ThreadPool {
private:
    vector<thread> workers;
    queue<function<void()>> tasks;
    mutex queue_mutex;
    condition_variable condition;
    bool stop_flag;

public:
    explicit ThreadPool(size_t num_threads) : stop_flag(false) {
        for (size_t i = 0; i < num_threads; ++i) {
            workers.emplace_back([this] {
                while (true) {
                    function<void()> task;
                    {
                        unique_lock<mutex> lock(this->queue_mutex);
                        this->condition.wait(lock, [this] {
                            return this->stop_flag || !this->tasks.empty();
                        });
                        if (this->stop_flag && this->tasks.empty()) return;
                        task = move(this->tasks.front());
                        this->tasks.pop();
                    }
                    task();
                }
            });
        }
    }

    template<typename F>
    auto enqueue(F&& f) -> future<typename result_of<F()>::type> {
        using return_type = typename result_of<F()>::type;
        auto task = make_shared<packaged_task<return_type()>>(forward<F>(f));
        future<return_type> result = task->get_future();
        {
            unique_lock<mutex> lock(queue_mutex);
            if (stop_flag) throw runtime_error("Enqueue on stopped ThreadPool");
            tasks.emplace([task]() { (*task)(); });
        }
        condition.notify_one();
        return result;
    }

    ~ThreadPool() {
        {
            unique_lock<mutex> lock(queue_mutex);
            stop_flag = true;
        }
        condition.notify_all();
        for (thread& worker : workers) {
            worker.join();
        }
    }
};

string get_language_from_ext(const string& file_path);
bool is_likely_binary_file(const string& file_path);
bool matches_dgatignore(const string& rel_path);
string sanitize_utf8(const string& input);
vector<string> extract_imports(const string& file_path, const string& content);
vector<string> extract_imports_fallback(const string& content, const string& lang);
vector<string> extract_imports_via_tree_sitter(const string& file_path, const string& content);
string normalize_import_path(const string& imp, const string& src_file);
bool is_path_in_gitignore(const string& rel_path);
string extract_assistant_text(const json& response_json);
string trim_copy(const string& input);

// using XXH128_hash_t (two uint64_t)
using digest_t = XXH128_hash_t;

digest_t fast_fingerprint(const string& file_content){
  XXH3_state_t* state = XXH3_createState();
  if (!state) {
      throw std::runtime_error("Failed to create XXH3 state");
  }

  XXH3_128bits_reset(state);
  XXH3_128bits_update(state, file_content.data(), file_content.size());

  digest_t digest = XXH3_128bits_digest(state);
  XXH3_freeState(state);

  return digest;
}

void print_digest(const digest_t& d) {
  std::cout << std::hex << std::setfill('0')
            << std::setw(16) << d.high64
            << std::setw(16) << d.low64
            << std::dec << "\n";
}

bool check_digests(const digest_t& d1, const digest_t& d2) {
  if (d1.high64 == d2.high64 && d1.low64 == d2.low64) return true;
  return false;
}

struct TreeNode {
    string name;
  int version; // id i use while writing dot nodes
  digest_t hash; // can be used later to track file version changes, chnaged to digest_t for better hashing
  string abs_path; // full path in system
  string rel_path; // path from project root (this one is key)
  vector<unique_ptr<TreeNode>> children;
  bool is_file; // true = file, false = folder
  vector<json> error_traces; // like [{"error": "...", "timestamp": "...", "solution": "..."}]
  string description; // extra file context if needed later
  vector<string> depends_on; // files this file depends on
  vector<string> depended_by; // files that depend on this file

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

struct DepNode {
  string name;
  string rel_path;
  string abs_path;
  string description;
  bool is_file;
  bool is_gitignored;
  string hash;
  vector<string> depends_on;
  vector<string> depended_by;
  DepNode() : is_file(true), is_gitignored(false) {}
};

struct DepEdge {
  string from_path;
  string to_path;
  string import_stmt;
  string description;
};

struct DepGraph {
  vector<DepNode> nodes;
  vector<DepEdge> edges;
  unordered_map<string, int> path_to_node;
};

// notebook cell stuff — tracks individual cells and their relationships
struct NotebookCell {
  int index;
  string cell_type;       // "code", "markdown", "raw"
  string source;          // concatenated source lines
  int execution_count;    // -1 if not executed
  bool has_been_executed;
  vector<string> imports; // extracted imports from this cell
  vector<string> defines; // functions, classes, variables defined
  vector<string> uses;    // variables/functions used from other cells
  vector<int> depends_on_cells; // cell indices this cell depends on
};

// parsed notebook container — holds all cells and aggregated metadata
struct ParsedNotebook {
  vector<NotebookCell> cells;
  int nbformat;
  string kernel_name;
  string language;
  string code_content;      // concatenated code cells only
  string markdown_content;  // concatenated markdown cells only
  vector<string> all_imports;
  bool is_valid;
  string error_message;
  ParsedNotebook() : nbformat(0), is_valid(false) {}
};

// forward decls for notebook parsing
ParsedNotebook parse_notebook_file(const string& abs_path);
vector<string> extract_cell_definitions(const string& source);
vector<string> extract_cell_uses(const string& source, const vector<string>& defined_in_cell);
void build_cell_dependencies(ParsedNotebook& notebook);
vector<string> extract_notebook_imports(const ParsedNotebook& notebook);
string notebook_to_description_content(const ParsedNotebook& notebook);
string extract_notebook_source_for_imports(const ParsedNotebook& notebook);

// normalize notebook source field — can be array of strings or single string
static string normalize_notebook_source(const json& source_field) {
  if (source_field.is_array()) {
    string result;
    for (const auto& line : source_field) {
      if (line.is_string()) result += line.get<string>();
    }
    return result;
  }
  if (source_field.is_string()) return source_field.get<string>();
  return "";
}

// parse a .ipynb file into our ParsedNotebook struct
ParsedNotebook parse_notebook_file(const string& abs_path) {
  ParsedNotebook nb;
  try {
    ifstream f(abs_path);
    if (!f.is_open()) {
      nb.error_message = "could not open file";
      return nb;
    }
    json root = json::parse(f);
    f.close();

    nb.nbformat = root.value("nbformat", 0);

    // grab kernel/language from metadata
    if (root.contains("metadata") && root["metadata"].is_object()) {
      auto& meta = root["metadata"];
      if (meta.contains("kernelspec") && meta["kernelspec"].is_object()) {
        nb.kernel_name = meta["kernelspec"].value("name", "");
      }
      if (meta.contains("language_info") && meta["language_info"].is_object()) {
        nb.language = meta["language_info"].value("name", "");
      }
    }

    if (!root.contains("cells") || !root["cells"].is_array()) {
      nb.error_message = "no cells array found";
      return nb;
    }

    for (size_t i = 0; i < root["cells"].size(); i++) {
      const auto& cell = root["cells"][i];
      if (!cell.is_object()) continue;

      NotebookCell nc;
      nc.index = static_cast<int>(i);
      nc.cell_type = cell.value("cell_type", "code");
      nc.source = normalize_notebook_source(cell.value("source", json("")));

      // execution count — default -1 if missing
      if (cell.contains("execution_count") && cell["execution_count"].is_number_integer()) {
        nc.execution_count = cell["execution_count"].get<int>();
        nc.has_been_executed = nc.execution_count > 0;
      } else {
        nc.execution_count = -1;
        nc.has_been_executed = false;
      }

      // skip empty cells
      if (trim_copy(nc.source).empty()) continue;

      nb.cells.push_back(nc);
    }

    if (nb.cells.empty()) {
      nb.error_message = "no non-empty cells";
      return nb;
    }

    // build code_content and markdown_content
    string code_acc, md_acc;
    for (auto& c : nb.cells) {
      if (c.cell_type == "code") {
        if (!code_acc.empty()) code_acc += "\n\n";
        code_acc += "# --- cell " + to_string(c.index) + " ---\n" + c.source;
      } else if (c.cell_type == "markdown") {
        if (!md_acc.empty()) md_acc += "\n\n";
        md_acc += c.source;
      }
    }
    nb.code_content = code_acc;
    nb.markdown_content = md_acc;

    // extract imports and definitions per code cell
    for (auto& c : nb.cells) {
      if (c.cell_type != "code") continue;
      c.imports = extract_imports_fallback(c.source, "python");
      c.defines = extract_cell_definitions(c.source);
    }

    // aggregate all imports
    {
      unordered_set<string> seen;
      for (const auto& c : nb.cells) {
        for (const auto& imp : c.imports) {
          if (!seen.count(imp)) {
            seen.insert(imp);
            nb.all_imports.push_back(imp);
          }
        }
      }
    }

    // build cross-cell dependencies
    build_cell_dependencies(nb);

    nb.is_valid = true;
  } catch (const exception& e) {
    nb.error_message = string("parse error: ") + e.what();
  }
  return nb;
}

// extract top-level definitions from a code cell source
vector<string> extract_cell_definitions(const string& source) {
  vector<string> defs;
  istringstream iss(source);
  string line;
  unordered_set<string> seen;

  while (getline(iss, line)) {
    line = trim_copy(line);
    // skip comments and blank lines
    if (line.empty() || line.rfind("#", 0) == 0) continue;

    // def func_name(
    if (line.rfind("def ", 0) == 0) {
      size_t paren = line.find('(');
      if (paren != string::npos) {
        string name = trim_copy(line.substr(4, paren - 4));
        if (!name.empty() && !seen.count(name)) {
          seen.insert(name);
          defs.push_back(name);
        }
      }
    }
    // class ClassName
    else if (line.rfind("class ", 0) == 0) {
      size_t paren = line.find('(');
      size_t colon = line.find(':');
      size_t end_pos = (paren != string::npos) ? min(paren, colon) : colon;
      if (end_pos != string::npos && end_pos > 6) {
        string name = trim_copy(line.substr(6, end_pos - 6));
        if (!name.empty() && !seen.count(name)) {
          seen.insert(name);
          defs.push_back(name);
        }
      }
    }
    // top-level variable assignment: name = ...
    else {
      size_t eq = line.find('=');
      if (eq != string::npos && eq > 0 && (eq + 1 < line.size()) && line[eq + 1] != '=') {
        // check it's top-level (no leading whitespace)
        if (!isspace(static_cast<unsigned char>(line[0]))) {
          string name = trim_copy(line.substr(0, eq));
          // strip possible tuple unpacking: a, b = ... → take first
          size_t comma = name.find(',');
          if (comma != string::npos) name = trim_copy(name.substr(0, comma));
          // must be a valid identifier
          if (!name.empty() && isalpha(static_cast<unsigned char>(name[0])) && !seen.count(name)) {
            seen.insert(name);
            defs.push_back(name);
          }
        }
      }
    }
  }
  return defs;
}

// simple python keyword/builtin set for filtering
static const unordered_set<string> python_keywords_builtins = {
  "if", "else", "elif", "for", "while", "return", "yield", "break", "continue",
  "pass", "raise", "try", "except", "finally", "with", "as", "import", "from",
  "class", "def", "lambda", "global", "nonlocal", "assert", "del", "in", "not",
  "and", "or", "is", "True", "False", "None", "self", "print", "len", "range",
  "int", "str", "float", "list", "dict", "set", "tuple", "bool", "type",
  "isinstance", "issubclass", "hasattr", "getattr", "setattr", "delattr",
  "super", "property", "staticmethod", "classmethod", "abs", "all", "any",
  "bin", "callable", "chr", "compile", "complex", "dir", "divmod", "enumerate",
  "eval", "exec", "filter", "format", "frozenset", "hash", "help", "hex",
  "id", "input", "iter", "locals", "map", "max", "min", "next", "object",
  "oct", "open", "ord", "pow", "repr", "reversed", "round", "slice", "sorted",
  "sum", "vars", "zip", "__name__", "__file__", "__doc__", "__init__",
};

// extract identifiers used in source that aren't defined in this cell
vector<string> extract_cell_uses(const string& source, const vector<string>& defined_in_cell) {
  unordered_set<string> local_defs(defined_in_cell.begin(), defined_in_cell.end());
  unordered_set<string> uses;
  vector<string> result;

  // simple word-boundary scan — collect identifiers
  string current;
  auto flush_word = [&]() {
    if (current.size() >= 2 && isalpha(static_cast<unsigned char>(current[0]))) {
      // skip keywords/builtins and local defs
      if (!python_keywords_builtins.count(current) && !local_defs.count(current)) {
        if (!uses.count(current)) {
          uses.insert(current);
          result.push_back(current);
        }
      }
    }
    current.clear();
  };

  for (char c : source) {
    if (isalnum(static_cast<unsigned char>(c)) || c == '_') {
      current += c;
    } else {
      flush_word();
    }
  }
  flush_word();

  return result;
}

// build cross-cell dependency links
void build_cell_dependencies(ParsedNotebook& notebook) {
  // collect defines per cell index for quick lookup
  unordered_map<int, vector<string>> defines_by_idx;
  for (const auto& c : notebook.cells) {
    if (c.cell_type == "code") {
      defines_by_idx[c.index] = c.defines;
    }
  }

  for (size_t i = 0; i < notebook.cells.size(); i++) {
    auto& c = notebook.cells[i];
    if (c.cell_type != "code") continue;

    c.uses = extract_cell_uses(c.source, c.defines);

    // check each use against defines from earlier cells
    unordered_set<int> dep_set;
    for (const auto& use : c.uses) {
      for (size_t j = 0; j < i; j++) {
        if (notebook.cells[j].cell_type != "code") continue;
        const auto& defs = defines_by_idx[notebook.cells[j].index];
        if (find(defs.begin(), defs.end(), use) != defs.end()) {
          dep_set.insert(notebook.cells[j].index);
        }
      }
    }
    c.depends_on_cells.assign(dep_set.begin(), dep_set.end());
    sort(c.depends_on_cells.begin(), c.depends_on_cells.end());
  }
}

// aggregate all imports from code cells
vector<string> extract_notebook_imports(const ParsedNotebook& notebook) {
  return notebook.all_imports;
}

// build a structured string for the LLM description prompt
string notebook_to_description_content(const ParsedNotebook& notebook) {
  if (!notebook.is_valid) return "";

  // count cells by type
  size_t code_count = 0, md_count = 0, executed = 0;
  for (const auto& c : notebook.cells) {
    if (c.cell_type == "code") { code_count++; if (c.has_been_executed) executed++; }
    else if (c.cell_type == "markdown") md_count++;
  }

  string out = "[notebook: " + to_string(code_count) + " code cells, "
    + to_string(md_count) + " markdown cells, "
    + to_string(executed) + " executed";
  if (!notebook.kernel_name.empty()) out += ", kernel: " + notebook.kernel_name;
  if (!notebook.language.empty()) out += ", lang: " + notebook.language;
  out += "]\n\n";

  // cell dependency summary
  bool has_deps = false;
  for (const auto& c : notebook.cells) {
    if (c.cell_type == "code" && !c.depends_on_cells.empty()) {
      has_deps = true;
      break;
    }
  }
  if (has_deps) {
    out += "cell dependencies:\n";
    for (const auto& c : notebook.cells) {
      if (c.cell_type == "code" && !c.depends_on_cells.empty()) {
        out += "  cell " + to_string(c.index) + " depends on cells: ";
        for (size_t j = 0; j < c.depends_on_cells.size(); j++) {
          if (j > 0) out += ", ";
          out += to_string(c.depends_on_cells[j]);
        }
        out += "\n";
      }
    }
    out += "\n";
  }

  // render cells
  for (const auto& c : notebook.cells) {
    out += "## cell " + to_string(c.index) + " (" + c.cell_type;
    if (c.cell_type == "code") {
      if (c.has_been_executed) out += ", executed";
      else out += ", not executed";
    }
    out += ")\n";
    out += trim_copy(c.source) + "\n\n";
  }

  return out;
}

// extract concatenated code cell source for import extraction
string extract_notebook_source_for_imports(const ParsedNotebook& notebook) {
  return notebook.code_content;
}

void print_dep_graph(const DepGraph& graph) {
  cout << "\n========================================" << endl;
  cout << "    DEPENDENCY GRAPH SUMMARY" << endl;
  cout << "========================================" << endl;
  cout << "Total Nodes: " << graph.nodes.size() << endl;
  cout << "Total Edges: " << graph.edges.size() << endl;
  cout << "----------------------------------------" << endl;
  cout << "Nodes:" << endl;
  for (size_t i = 0; i < graph.nodes.size(); i++) {
    const auto& node = graph.nodes[i];
    cout << "  [" << i << "] " << node.name;
    if (node.is_gitignored) cout << " (gitignored)";
    cout << endl;
    cout << "      Path: " << node.rel_path << endl;
    cout << "      Desc: " << node.description << endl;
  }
  if (graph.nodes.empty()) {
    cout << "  (no nodes)" << endl;
  }
  cout << "----------------------------------------" << endl;
  cout << "Edges:" << endl;
  for (size_t i = 0; i < graph.edges.size(); i++) {
    const auto& edge = graph.edges[i];
    cout << "  [" << i << "] " << edge.from_path << " -> " << edge.to_path << endl;
    if (!edge.import_stmt.empty()) {
      cout << "      Import: " << edge.import_stmt << endl;
    }
  }
  if (graph.edges.empty()) {
    cout << "  (no edges)" << endl;
  }
  cout << "========================================\n" << endl;
}

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

vector<string> build_artifacts_to_skip = {
  "build", "dist", "target", "out", "bin", "obj",
  "CMakeCache.txt", "CMakeFiles", "cmake_install.cmake",
  "Makefile", "GNUmakefile",
  ".cmake", "CMakeError.log", "CMakeOutput.log",
  "compile_commands.json",
};

unordered_set<string> python_stdlib = {
  "os", "sys", "re", "json", "math", "time", "datetime", "random", "collections",
  "itertools", "functools", "operator", "string", "pathlib", "typing", "abc",
  "io", "csv", "logging", "warnings", "threading", "multiprocessing", "asyncio",
  "socket", "ssl", "http", "urllib", "email", "html", "xml", "webbrowser",
  "dataclasses", "enum", "copy", "pprint", "textwrap", "unittest", "doctest",
  "argparse", "optparse", "getopt", "shutil", "glob", "fnmatch", "tempfile",
  "platform", "errno", "ctypes", "weakref", "gc", "inspect", "traceback",
  "code", "codeop", "subprocess", "popen2", "signal", "mmap", "msvcrt",
  "posixpath", "ntpath", "genericpath", "posix", "nt", "_thread", "_io",
  "hashlib", "hmac", "secrets", "base64", "binascii", "struct", "codecs",
  "encodings", "codec_info", "locale", "gettext", "parser", "ast", "symtable",
  "keyword", "token", "tokenize", "astroid", "py_compile", "compileall",
  "dis", "pickle", "shelve", "marshal", "dbm", "gdbm", "sqlite3",
  "csv", "tarfile", "zipfile", "zlib", "gzip", "bz2", "lzma", "zipimport",
  "configparser", "plistlib", "netrc", "xdrlib", "robotparser", "mimetypes",
  "MimeWriter", "mhlib", "mailbox", "mailcap", "multifile", "fileinput",
  "stat", "statvfs", "stat_cache", "filecmp", "dircache", "linecache",
  "cmd", "code", "readline", "rlcompleter", "getpass", "curses", "termios",
  "tty", "pty", "fcntl", "pipes", "resource", "nis", "optik", "opus",
  "audioop", "imageop", "aifc", "sunau", "wave", "chunk", "sndhdr",
  "imghdr", "ossaudiodev", "sunaudiodev", "vorbis", "flac", "oggsize",
  "xxsubtype", "formatter", "simplejson", "ujson", "orjson", "msgpack",
  "cffi", "cython", "numpy", "pandas", "six", "future", "builtins",
};

bool is_stdlib_import(const string& imp, const string& lang) {
  if (lang == "python") {
    size_t dot = imp.find('.');
    string module = (dot != string::npos) ? imp.substr(0, dot) : imp;
    return python_stdlib.count(module) > 0;
  }
  return false;
}

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

bool matches_gitignore(const string& name);
vector<string> gitignore_patterns;

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
  if (find(build_artifacts_to_skip.begin(), build_artifacts_to_skip.end(), fname) != build_artifacts_to_skip.end()) {
    return nullptr;
  }

  string rel_path = fs::relative(current_path, root_path).generic_string();
  if (rel_path.empty()) rel_path = ".";

  if (!gitignore_patterns.empty() && is_path_in_gitignore(rel_path)) {
    return nullptr;
  }

  string name = (current_path == root_path)
    ? fs::absolute(root_path).filename().string()
    : current_path.filename().string();
  if (name.empty()) name = "root";

  string abs_path = fs::absolute(current_path).string();
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

void collect_source_files(TreeNode* node, unordered_map<string, string>& contents, unordered_map<string, TreeNode*>& files, bool skip_dgatignore) {
  if (!node) return;
  if (node->is_file) {
    if (skip_dgatignore && matches_dgatignore(node->rel_path)) {
      return;
    }
    string lang = get_language_from_ext(node->rel_path);
    if (!lang.empty()) {
      files[node->rel_path] = node;
      if (lang == "ipython") {
        // parse notebook and store structured content instead of raw json
        ParsedNotebook nb = parse_notebook_file(node->abs_path);
        if (nb.is_valid) {
          contents[node->rel_path] = notebook_to_description_content(nb);
        }
      } else if (!is_likely_binary_file(node->abs_path)) {
        ifstream infile(node->abs_path);
        if (infile.is_open()) {
          stringstream buffer;
          buffer << infile.rdbuf();
          contents[node->rel_path] = sanitize_utf8(buffer.str());
        }
      }
    }
  }
  for (const auto& child : node->children) collect_source_files(child.get(), contents, files, skip_dgatignore);
}

TreeNode* find_node_by_path(TreeNode* node, const string& rel_path) {
  if (!node) return nullptr;
  if (node->rel_path == rel_path) return node;
  for (auto& child : node->children) {
    TreeNode* found = find_node_by_path(child.get(), rel_path);
    if (found) return found;
  }
  return nullptr;
}

DepGraph build_dep_graph(TreeNode* root) {
  DepGraph graph;
  if (!root) return graph;

  unordered_map<string, string> contents;
  unordered_map<string, TreeNode*> files;
  collect_source_files(root, contents, files, true);

  unordered_set<string> known_files;
  for (const auto& [rel_path, _] : contents) {
    known_files.insert(rel_path);
  }

  const size_t NUM_THREADS = 8;
  mutex graph_mutex;
  atomic<int> processed{0};
  atomic<int> total{static_cast<int>(contents.size())};

  cout << "[DGAT] Processing " << contents.size() << " files with " << NUM_THREADS << " workers..." << endl;

  ThreadPool pool(NUM_THREADS);
  vector<future<void>> futures;

  for (const auto& [rel_path, content] : contents) {
    futures.push_back(pool.enqueue([&]() {
      string lang = get_language_from_ext(rel_path);

      vector<string> imports;
      if (lang == "ipython") {
        // notebooks need abs_path to read from disk
        auto it = files.find(rel_path);
        if (it != files.end()) {
          ParsedNotebook nb = parse_notebook_file(it->second->abs_path);
          if (nb.is_valid) {
            // try tree-sitter on concatenated code cells first
            string code = nb.code_content;
            vector<string> ts_imports = extract_imports_via_tree_sitter(rel_path, code);
            if (!ts_imports.empty()) {
              imports = ts_imports;
            } else {
              // fallback to manual extraction per cell
              imports = extract_notebook_imports(nb);
            }
          }
        }
      } else {
        imports = extract_imports(rel_path, content);
      }

      vector<pair<string, string>> local_edges;

      for (const string& imp : imports) {
        // skip stdlib imports
        if (is_stdlib_import(imp, lang)) {
          continue;
        }

        // skip system includes marker
        if (imp.rfind("__SYSTEM_INCLUDE__:", 0) == 0) {
          continue;
        }

        string norm = normalize_import_path(imp, rel_path);
        if (norm.empty()) continue;

        // try exact path first, then common extensions, then barrel index files
        // this covers: "@/lib/utils" → "frontend/src/lib/utils.ts"
        //              "../components/Foo" → ".../Foo.tsx"
        //              "some/module" → "some/module/index.ts" (barrel)
        bool is_internal = false;
        {
          static const vector<string> try_exts = {
            "", ".py", ".tsx", ".ts", ".jsx", ".js", ".css", ".scss", ".h", ".hpp"
          };
          static const vector<string> index_exts = {
            ".tsx", ".ts", ".jsx", ".js"
          };
          static const vector<string> init_exts = {
            "/__init__.py"
          };

          for (auto& ext : try_exts) {
            if (known_files.count(norm + ext)) {
              norm = norm + ext;
              is_internal = true;
              break;
            }
          }
          // barrel import — try norm/index.*
          if (!is_internal) {
            for (auto& ext : index_exts) {
              string candidate = norm + "/index" + ext;
              if (known_files.count(candidate)) {
                norm = candidate;
                is_internal = true;
                break;
              }
            }
          }
          // Python package init — try norm/__init__.py
          if (!is_internal) {
            for (auto& ext : init_exts) {
              string candidate = norm + ext;
              if (known_files.count(candidate)) {
                norm = candidate;
                is_internal = true;
                break;
              }
            }
          }
        }

        // last resort: match by filename only (catches c/cpp header-only scenarios)
        if (!is_internal) {
          string imp_name = fs::path(imp).filename().string();
          for (const auto& [file_path, _] : contents) {
            string fname = fs::path(file_path).filename().string();
            if (fname == imp_name || fname == imp_name + ".h" || fname == imp_name + ".hpp") {
              norm = file_path;
              is_internal = true;
              break;
            }
          }
        }

        // only add edge if file exists in tree - skip external
        if (is_internal) {
          local_edges.emplace_back(norm, imp);
        }
      }

      {
        lock_guard<mutex> lock(graph_mutex);
        for (const auto& [to_path, import_stmt] : local_edges) {
          if (!graph.path_to_node.count(to_path)) {
            bool gitignored = is_path_in_gitignore(to_path);
            DepNode node;
            node.name = fs::path(to_path).filename().string();
            node.rel_path = to_path;
            node.description = gitignored ? "Gitignored dependency" : "External dependency";
            node.is_gitignored = gitignored;
            graph.path_to_node[to_path] = graph.nodes.size();
            graph.nodes.push_back(node);
          }

          DepEdge edge;
          edge.from_path = rel_path;
          edge.to_path = to_path;
          edge.import_stmt = import_stmt;
          graph.edges.push_back(edge);
        }

        int count = ++processed;
        if (count % 10 == 0 || count == total) {
          float pct = (float)count / total * 100;
          cout << "\r[DGAT] Processing: " << count << "/" << total
               << " (" << fixed << setprecision(1) << pct << "%)" << flush;
        }
      }
    }));
  }

  for (auto& f : futures) {
    f.get();
  }

  cout << "\r[DGAT] Processing complete!" << endl;

  unordered_set<string> all_node_ids;
  for (const auto& node : graph.nodes) {
    all_node_ids.insert(node.rel_path);
  }

  for (const auto& edge : graph.edges) {
    if (!all_node_ids.count(edge.from_path)) {
      DepNode node;
      node.name = fs::path(edge.from_path).filename().string();
      node.rel_path = edge.from_path;
      node.is_file = true;
      node.is_gitignored = false;

      TreeNode* tn = find_node_by_path(root, edge.from_path);
      if (tn) {
        node.abs_path = tn->abs_path;
        node.description = tn->description;
        ostringstream oss;
        oss << std::hex << std::setfill('0')
            << std::setw(16) << tn->hash.high64
            << std::setw(16) << tn->hash.low64;
        node.hash = oss.str();
      } else {
        node.abs_path = "";
        node.description = "Source file";
        node.hash = "";
      }

      graph.path_to_node[edge.from_path] = graph.nodes.size();
      graph.nodes.push_back(node);
      all_node_ids.insert(edge.from_path);
    }
  }

  for (auto& node : graph.nodes) {
    for (const auto& edge : graph.edges) {
      if (edge.from_path == node.rel_path) {
        node.depends_on.push_back(edge.to_path);
      }
      if (edge.to_path == node.rel_path) {
        node.depended_by.push_back(edge.from_path);
      }
    }
  }

  return graph;
}

void populate_dependency_descriptions(DepGraph& graph) {
  if (graph.nodes.empty()) return;

  unordered_map<string, vector<string>> importers;
  for (const auto& edge : graph.edges) {
    importers[edge.to_path].push_back(edge.from_path);
  }

  cout << "[DGAT] Populating descriptions for " << graph.nodes.size() << " dependency nodes..." << endl;

  const size_t BATCH_SIZE = 8;
  mutex graph_mutex;
  atomic<int> processed{0};
  atomic<int> total{static_cast<int>(graph.nodes.size())};

  ThreadPool pool(BATCH_SIZE);
  vector<future<void>> futures;

  for (size_t i = 0; i < graph.nodes.size(); i++) {
    auto& node = graph.nodes[i];
    if (node.description != "External dependency" && node.description != "Gitignored dependency") {
      continue;
    }

    futures.push_back(pool.enqueue([&, i]() {
      string dep_name = node.name;
      string importers_list = "";
      auto it = importers.find(node.rel_path);
      if (it != importers.end() && !it->second.empty()) {
        for (size_t j = 0; j < it->second.size() && j < 5; j++) {
          if (j > 0) importers_list += ", ";
          importers_list += it->second[j];
        }
        if (it->second.size() > 5) importers_list += " and " + to_string(it->second.size() - 5) + " more";
      }

      const string dep_desc_prompt = R"J2(Provide a brief description (1-2 sentences) of the external dependency "{{ dep_name }}" used in software development.

  {% if importers %}
  This dependency is imported by: {{ importers }}
  {% endif %}

  Return ONLY a simple description, no markdown formatting.)J2";

      json prompt_data = {
        {"dep_name", dep_name},
        {"importers", importers_list}
      };

      inja::Environment env;
      string rendered_prompt = env.render(dep_desc_prompt, prompt_data);

      json request_payload = {
        {"model", "Qwen/Qwen3.5-2B"},
        {"messages", {
          {
            {"role", "user"},
            {"content", rendered_prompt}
          }
        }}
      };

      httplib::Client cli("localhost", 8000);
      auto res = cli.Post("/v1/chat/completions", request_payload.dump(), "application/json");

      {
        lock_guard<mutex> lock(graph_mutex);
        if (res && res->status == 200) {
          try {
            json response_json = json::parse(res->body);
            string assistant_text = extract_assistant_text(response_json);
            if (!assistant_text.empty()) {
              graph.nodes[i].description = trim_copy(assistant_text);
            }
          } catch (const std::exception& e) {
            cerr << "Failed to parse dependency description for " << dep_name << ": " << e.what() << endl;
          }
        } else {
          cerr << "Failed to get description for dependency: " << dep_name << endl;
        }

        int count = ++processed;
        if (count % 5 == 0 || count == total) {
          float pct = (float)count / total * 100;
          cout << "\r[DGAT] Dependency descriptions: " << count << "/" << total
               << " (" << fixed << setprecision(1) << pct << "%)" << flush;
        }
      }
    }));
  }

  for (auto& f : futures) {
    f.get();
  }

  cout << "\r[DGAT] Dependency descriptions complete!             " << endl;
}

// one-sentence relationship desc per edge — what does A use from B and why
void populate_edge_descriptions(DepGraph& graph) {
  if (graph.edges.empty()) return;

  // build a quick lookup: rel_path -> description
  unordered_map<string, string> node_desc;
  for (const auto& node : graph.nodes) {
    node_desc[node.rel_path] = node.description;
  }

  // placeholder descs — skip edges where either side has no real description
  auto is_placeholder = [](const string& d) {
    return d.empty() || d == "Source file" || d == "External dependency"
        || d == "Gitignored dependency";
  };

  cout << "[DGAT] Populating edge descriptions for " << graph.edges.size() << " edges..." << endl;

  const size_t BATCH_SIZE = 8;
  mutex edge_mutex;
  atomic<int> processed{0};
  int total = static_cast<int>(graph.edges.size());

  ThreadPool pool(BATCH_SIZE);
  vector<future<void>> futures;

  for (size_t i = 0; i < graph.edges.size(); i++) {
    const auto& edge = graph.edges[i];
    string from_desc = node_desc.count(edge.from_path) ? node_desc[edge.from_path] : "";
    string to_desc   = node_desc.count(edge.to_path)   ? node_desc[edge.to_path]   : "";

    // skip if either side is boring — llm won't add anything useful
    if (is_placeholder(from_desc) || is_placeholder(to_desc)) continue;

    futures.push_back(pool.enqueue([&, i, from_desc, to_desc]() {
      const auto& e = graph.edges[i];

      const string edge_prompt = R"J2(given these two files in the same project:

file A: `{{ from_path }}`
description: {{ from_desc }}

file B: `{{ to_path }}`
description: {{ to_desc }}

import statement: `{{ import_stmt }}`

in one tight sentence, describe what file A uses from file B and why.
return only the sentence, no preamble.)J2";

      json prompt_data = {
        {"from_path",   e.from_path},
        {"from_desc",   from_desc},
        {"to_path",     e.to_path},
        {"to_desc",     to_desc},
        {"import_stmt", e.import_stmt}
      };

      inja::Environment env;
      string rendered = env.render(edge_prompt, prompt_data);

      json payload = {
        {"model", "Qwen/Qwen3.5-2B"},
        {"messages", {{{"role", "user"}, {"content", rendered}}}}
      };

      httplib::Client cli("localhost", 8000);
      auto res = cli.Post("/v1/chat/completions", payload.dump(), "application/json");

      {
        lock_guard<mutex> lock(edge_mutex);
        if (res && res->status == 200) {
          try {
            json rj = json::parse(res->body);
            string txt = extract_assistant_text(rj);
            if (!txt.empty()) {
              graph.edges[i].description = trim_copy(txt);
            }
          } catch (const std::exception& ex) {
            cerr << "edge desc parse error: " << ex.what() << endl;
          }
        }
        int count = ++processed;
        if (count % 5 == 0 || count == total) {
          float pct = (float)count / total * 100;
          cout << "\r[DGAT] Edge descriptions: " << count << "/" << total
               << " (" << fixed << setprecision(1) << pct << "%)" << flush;
        }
      }
    }));
  }

  for (auto& f : futures) f.get();
  cout << "\r[DGAT] Edge descriptions complete!                   " << endl;
}

json build_dep_graph_json(const DepGraph& graph) {
  json result = json::object();
  result["nodes"] = json::array();
  result["edges"] = json::array();

  for (const auto& node : graph.nodes) {
    // serialize every field — frontend needs the full picture for the inspector panel
    json n = {
      {"id",            node.rel_path},
      {"name",          node.name},
      {"rel_path",      node.rel_path},
      {"abs_path",      node.abs_path},
      {"description",   node.description},
      {"is_file",       node.is_file},
      {"is_gitignored", node.is_gitignored},
      {"hash",          node.hash},
      {"depends_on",    node.depends_on},
      {"depended_by",   node.depended_by}
    };
    result["nodes"].push_back(n);
  }

  for (const auto& edge : graph.edges) {
    json e = {
      {"from", edge.from_path},
      {"to", edge.to_path},
      {"import_stmt", edge.import_stmt},
      {"description", edge.description}
    };
    result["edges"].push_back(e);
  }

  return result;
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

string trim_copy(const string& input);

void load_gitignore(const fs::path& root) {
  fs::path gitignore_path = root / ".gitignore";
  if (!fs::exists(gitignore_path)) return;

  ifstream infile(gitignore_path.string());
  if (!infile.is_open()) return;

  string line;
  while (getline(infile, line)) {
    line = trim_copy(line);
    if (line.empty() || line.front() == '#') continue;
    gitignore_patterns.push_back(line);
  }
  infile.close();
}

vector<string> dgatignore_patterns;

// maps alias prefix → resolved prefix, e.g. "@/" → "frontend/src/"
// populated by load_tsconfig_aliases() before build_dep_graph runs
unordered_map<string, string> ts_path_aliases;

// walk dirs looking for tsconfig.json / jsconfig.json and parse compilerOptions.paths
// so "@/components/Foo" resolves to "frontend/src/components/Foo" etc.
void load_tsconfig_aliases(const fs::path& root) {
  ts_path_aliases.clear();

  // bfs — stop at first tsconfig.json found (usually one per project)
  queue<fs::path> dirs;
  dirs.push(root);

  fs::path found_config;
  fs::path config_dir;

  while (!dirs.empty() && found_config.empty()) {
    fs::path cur = dirs.front(); dirs.pop();
    for (auto& name : {"tsconfig.json", "jsconfig.json"}) {
      fs::path candidate = cur / name;
      if (fs::exists(candidate)) {
        found_config = candidate;
        config_dir = cur;
        break;
      }
    }
    if (!found_config.empty()) break;
    try {
      for (auto& entry : fs::directory_iterator(cur)) {
        if (entry.is_directory()) {
          string dname = entry.path().filename().string();
          // skip heavy dirs — we only want source dirs
          if (dname == "node_modules" || dname == ".git" || dname == "build" ||
              dname == "dist" || dname == ".next" || dname == "out") continue;
          dirs.push(entry.path());
        }
      }
    } catch (...) {}
  }

  if (found_config.empty()) return;

  ifstream f(found_config);
  if (!f.is_open()) return;

  try {
    json tsconfig = json::parse(f, nullptr, /*exceptions=*/true, /*ignore_comments=*/true);
    auto& opts = tsconfig["compilerOptions"];
    if (!opts.is_object()) return;
    auto& paths = opts["paths"];
    if (!paths.is_object()) return;

    // config_dir relative to project root (e.g. "frontend")
    string config_rel = fs::relative(config_dir, root).generic_string();
    if (config_rel == ".") config_rel = "";

    for (auto& [alias_pattern, targets] : paths.items()) {
      if (!targets.is_array() || targets.empty()) continue;
      string target = targets[0].get<string>();

      // strip leading "./" from target
      if (target.rfind("./", 0) == 0) target = target.substr(2);

      // strip trailing "/*" wildcard from both sides
      string alias = alias_pattern;
      bool wildcard = alias.size() >= 2 && alias.substr(alias.size() - 2) == "/*";
      if (wildcard) {
        alias = alias.substr(0, alias.size() - 2) + "/";
        if (target.size() >= 2 && target.substr(target.size() - 2) == "/*")
          target = target.substr(0, target.size() - 2) + "/";
      } else {
        alias += "/";
        target += "/";
      }

      // prefix target with config_dir so it becomes a repo-relative path
      string resolved = config_rel.empty() ? target : config_rel + "/" + target;
      ts_path_aliases[alias] = resolved;
    }

    if (!ts_path_aliases.empty()) {
      cout << "[DGAT] Loaded " << ts_path_aliases.size() << " TS path alias(es) from "
           << fs::relative(found_config, root).generic_string() << endl;
      for (auto& [k, v] : ts_path_aliases)
        cout << "  " << k << " -> " << v << endl;
    }
  } catch (const exception& e) {
    cerr << "[DGAT] Warning: could not parse tsconfig aliases: " << e.what() << endl;
  }
}

void load_dgatignore(const fs::path& root) {
  fs::path dgatignore_path = root / ".dgatignore";
  if (!fs::exists(dgatignore_path)) return;

  ifstream infile(dgatignore_path.string());
  if (!infile.is_open()) return;

  string line;
  while (getline(infile, line)) {
    line = trim_copy(line);
    if (line.empty() || line.front() == '#') continue;
    dgatignore_patterns.push_back(line);
  }
  infile.close();
}

bool matches_dgatignore(const string& rel_path) {
  if (rel_path.empty() || rel_path == ".") return false;

  string rp = fs::path(rel_path).generic_string();
  string fname = fs::path(rp).filename().string();

  for (const auto& pat_raw : dgatignore_patterns) {
    string pat = trim_copy(pat_raw);
    if (pat.empty()) continue;

    bool anchored = !pat.empty() && pat.front() == '/';
    if (anchored) pat.erase(pat.begin());

    bool dir_only = !pat.empty() && pat.back() == '/';
    if (dir_only) pat.pop_back();

    if (pat.empty()) continue;

    if (!dir_only && (fname == pat || rp == pat)) return true;

    if (pat.find('*') != string::npos) {
      size_t star = pat.find('*');
      string prefix = pat.substr(0, star);
      string suffix = pat.substr(star + 1);
      const string& target = anchored ? rp : fname;
      if (target.size() >= prefix.size() + suffix.size() &&
          target.compare(0, prefix.size(), prefix) == 0 &&
          target.compare(target.size() - suffix.size(), suffix.size(), suffix) == 0) {
        return true;
      }
      continue;
    }

    if (dir_only) {
      if (rp.find(pat + "/") == 0) return true;
      string with_slash = "/" + pat + "/";
      if (rp.find(with_slash) != string::npos) return true;
    }
  }
  return false;
}

bool matches_gitignore(const string& name) {
  for (const auto& pat : gitignore_patterns) {
    if (pat == name) return true;
    if (pat.size() > 1 && pat.front() == '/' && pat.substr(1) == name) return true;
    if (pat.size() > 1 && pat.back() == '/') {
      string dir_prefix = pat.substr(1, pat.size() - 2);
      if (name.find(dir_prefix) == 0) return true;
      if (name.substr(0, name.find('/')) == dir_prefix) return true;
    }
    if (pat.find("*/") == string::npos && pat.find('*') != string::npos) {
      size_t star = pat.find('*');
      string prefix = pat.substr(0, star);
      string suffix = pat.substr(star + 1);
      if (name.size() >= prefix.size() + suffix.size() &&
          name.substr(0, prefix.size()) == prefix &&
          name.substr(name.size() - suffix.size()) == suffix) {
        return true;
      }
    }
  }
  return false;
}

bool is_path_in_gitignore(const string& rel_path) {
  if (rel_path.empty() || rel_path == ".") return false;

  string rp = fs::path(rel_path).generic_string();
  string fname = fs::path(rp).filename().string();

  for (const auto& pat_raw : gitignore_patterns) {
    string pat = trim_copy(pat_raw);
    if (pat.empty()) continue;

    bool anchored = !pat.empty() && pat.front() == '/';
    if (anchored) pat.erase(pat.begin());

    bool dir_only = !pat.empty() && pat.back() == '/';
    if (dir_only) pat.pop_back();

    if (pat.empty()) continue;

    // exact file name ignore (e.g. dgat, dgat_blueprint.md)
    if (!dir_only && (fname == pat || rp == pat)) return true;

    // simple wildcard like *.o
    if (pat.find('*') != string::npos) {
      size_t star = pat.find('*');
      string prefix = pat.substr(0, star);
      string suffix = pat.substr(star + 1);
      const string& target = anchored ? rp : fname;
      if (target.size() >= prefix.size() + suffix.size() &&
          target.compare(0, prefix.size(), prefix) == 0 &&
          target.compare(target.size() - suffix.size(), suffix.size(), suffix) == 0) {
        return true;
      }
      continue;
    }

    // directory pattern (e.g. build/, tmp/, grammars/)
    if (dir_only) {
      if (rp == pat) return true;
      if (rp.rfind(pat + "/", 0) == 0) return true;
      if (!anchored && rp.find("/" + pat + "/") != string::npos) return true;
      continue;
    }

    // fallback plain path match
    if (rp == pat) return true;
  }

  return false;
}

string trim_copy(const string& input) {
  size_t start = 0;
  while (start < input.size() && isspace(static_cast<unsigned char>(input[start]))) {
    start++;
  }

  size_t end = input.size();
  while (end > start && isspace(static_cast<unsigned char>(input[end - 1]))) {
    end--;
  }

  return input.substr(start, end - start);
}

vector<string> extract_file_mentions(const string& content, const string& file_ext) {
  vector<string> mentions;
  istringstream iss(content);
  string line;

  auto add_if_valid = [&](const string& path) {
    if (!path.empty() && path != "." && path != "..") {
      mentions.push_back(path);
    }
  };

  if (file_ext == ".sh" || file_ext == ".bash") {
    while (getline(iss, line)) {
      line = trim_copy(line);
      if (line.find('#') != string::npos) {
        line = line.substr(0, line.find('#'));
        line = trim_copy(line);
      }
      if (line.rfind("source ", 0) == 0 || line.rfind(". ", 0) == 0) {
        size_t pos = line.find(' ');
        if (pos != string::npos) {
          add_if_valid(line.substr(pos + 1));
        }
      }
      if (line.find("./") != string::npos) {
        size_t pos = line.find("./");
        add_if_valid(line.substr(pos + 2));
      }
    }
  } else if (file_ext == ".make" || file_ext == "Makefile") {
    while (getline(iss, line)) {
      if (line.find("include") != string::npos || line.find("-include") != string::npos) {
        istringstream incl(line);
        string word;
        while (incl >> word) {
          if (word != "include" && word != "-include") {
            add_if_valid(word);
          }
        }
      }
    }
  }

  return mentions;
}

string get_language_from_ext(const string& file_path) {
  size_t dot_pos = file_path.rfind('.');
  string ext = (dot_pos != string::npos) ? file_path.substr(dot_pos) : "";
  string name = file_path;

  if (name.find("Makefile") != string::npos) return "make";
  if (name.find("CMakeLists.txt") != string::npos) return "cmake";

  unordered_map<string, string> ext_to_lang = {
    {".c", "c"}, {".h", "c"},
    {".cpp", "cpp"}, {".cc", "cpp"}, {".cxx", "cpp"}, {".c++", "cpp"},
    {".hpp", "cpp"}, {".hh", "cpp"}, {".hxx", "cpp"}, {".h++", "cpp"},
    {".cu", "cuda"}, {".cuh", "cuda"},
    {".py", "python"}, {".pyw", "python"},
    {".ipynb", "ipython"},
    {".go", "go"},
    {".js", "javascript"}, {".mjs", "javascript"}, {".cjs", "javascript"},
    {".jsx", "javascript"},
    {".ts", "typescript"}, {".tsx", "typescript"},
    {".rs", "rust"},
    {".java", "java"}, {".kt", "kotlin"}, {".kts", "kotlin"},
    {".scala", "scala"},
    {".cs", "csharp"},
    {".rb", "ruby"},
    {".php", "php"},
    {".swift", "swift"},
    {".dart", "dart"},
    {".sh", "bash"}, {".bash", "bash"}, {".zsh", "bash"}, {".fish", "bash"},
    {".ps1", "powershell"}, {".psm1", "powershell"},
    {".lua", "lua"},
    {".r", "r"}, {".R", "r"},
    {".pl", "perl"}, {".pm", "perl"},
    {".ex", "elixir"}, {".exs", "elixir"},
    {".erl", "erlang"},
    {".hs", "haskell"},
    {".ml", "ocaml"}, {".mli", "ocaml"},
    {".jl", "julia"},
    {".sql", "sql"},
    {".yml", "yaml"}, {".yaml", "yaml"},
    {".json", "json"},
    {".toml", "toml"},
    {".xml", "xml"},
    {".html", "html"}, {".htm", "html"},
    {".css", "css"},
    {".scss", "scss"}, {".sass", "scss"}, {".less", "less"},
    {".vue", "vue"},
    {".svelte", "svelte"},
    {".md", "markdown"},
    {".dockerfile", "dockerfile"},
    {".tf", "terraform"}, {".hcl", "terraform"},
  };

  auto it = ext_to_lang.find(ext);
  return (it != ext_to_lang.end()) ? it->second : "";
}

string get_grammars_dir() {
  const char* env_grammars = getenv("DGAT_GRAMMARS_DIR");
  if (env_grammars && fs::exists(env_grammars)) {
    return string(env_grammars);
  }
  if (fs::exists("grammars")) {
    return "grammars";
  }
  // binary-relative: check next to the dgat executable
  try {
    fs::path bin_dir = fs::read_symlink("/proc/self/exe").parent_path();
    fs::path bin_grammars = bin_dir / "grammars";
    if (fs::exists(bin_grammars)) return bin_grammars.string();
    // also check ../share/dgat/grammars from binary dir (for installed layouts)
    fs::path share_grammars = bin_dir / ".." / "share" / "dgat" / "grammars";
    if (fs::exists(share_grammars)) return fs::canonical(share_grammars).string();
  } catch (...) {}
  if (fs::exists("/usr/local/share/dgat/grammars")) {
    return "/usr/local/share/dgat/grammars";
  }
  if (fs::exists("/usr/share/dgat/grammars")) {
    return "/usr/share/dgat/grammars";
  }
  return "";
}

string get_queries_dir() {
  if (fs::exists("queries")) {
    return fs::absolute("queries").string();
  }
  // binary-relative
  try {
    fs::path bin_dir = fs::read_symlink("/proc/self/exe").parent_path();
    fs::path bin_queries = bin_dir / "queries";
    if (fs::exists(bin_queries)) return bin_queries.string();
    fs::path share_queries = bin_dir / ".." / "share" / "dgat" / "queries";
    if (fs::exists(share_queries)) return fs::canonical(share_queries).string();
  } catch (...) {}
  if (fs::exists("/usr/local/share/dgat/queries")) {
    return "/usr/local/share/dgat/queries";
  }
  if (fs::exists("/usr/share/dgat/queries")) {
    return "/usr/share/dgat/queries";
  }
  return "";
}

string run_tree_sitter_query(const string& lang, const string& file_path, const string& content) {
  string queries_dir = get_queries_dir();
  if (queries_dir.empty()) return "";
  fs::path query_file = fs::path(queries_dir) / (lang + ".scm");
  if (!fs::exists(query_file)) {
    return "";
  }

  // Use unique filename: PID + timestamp + random to avoid race conditions
  auto now = chrono::high_resolution_clock::now();
  auto us = chrono::duration_cast<chrono::microseconds>(now.time_since_epoch()).count();
  int pid = getpid();
  int rand_val = rand() % 10000;
  string tmp_input = "/tmp/ts_input_" + to_string(pid) + "_" + to_string(us) + "_" + to_string(rand_val) + ".txt";

  ofstream tmp_out(tmp_input);
  tmp_out << content;
  tmp_out.close();

  string grammars_dir = get_grammars_dir();
  string cmd = "tree-sitter query";
  if (!grammars_dir.empty()) {
    // handle scoped packages like @abir-taheer/tree-sitter-ipython
    string grammar_pkg = grammars_dir + "/node_modules/tree-sitter-" + lang;
    if (!fs::exists(grammar_pkg)) {
      // try scoped package path
      string scoped = grammars_dir + "/node_modules/@abir-taheer/tree-sitter-" + lang;
      if (fs::exists(scoped)) grammar_pkg = scoped;
    }
    cmd += " -p " + grammar_pkg;
  }
  cmd += " " + query_file.string() + " " + tmp_input + " 2>&1";

  array<char, 4096> buffer;
  string result;

  auto close_pipe = [](FILE* stream) { if (stream) pclose(stream); };
  unique_ptr<FILE, decltype(close_pipe)> pipe(popen(cmd.c_str(), "r"), close_pipe);
  if (!pipe) {
    fs::remove(tmp_input);
    return "";
  }

  while (fgets(buffer.data(), buffer.size(), pipe.get()) != nullptr) {
    result += buffer.data();
  }

  fs::remove(tmp_input);
  return result;
}

vector<string> extract_imports_via_tree_sitter(const string& file_path, const string& content) {
  vector<string> imports;

  string lang = get_language_from_ext(file_path);
  if (lang.empty()) {
    return imports;
  }

  static bool ts_checked = false;
  static bool ts_available = false;
  if (!ts_checked) {
    ts_checked = true;
    // Use explicit PATH check - try multiple common locations
    const char* path_env = getenv("PATH");
    string paths = path_env ? path_env : "";
    vector<string> search_paths = {"/usr/local/bin", "/usr/bin", "/bin",
                                    "/home/pradheep/.local/bin",
                                    "/home/pradheep/.local/share/mise/installs/node/22.20.0/bin"};
    for (const auto& p : search_paths) {
      fs::path ts_path = fs::path(p) / "tree-sitter";
      if (fs::exists(ts_path)) {
        ts_available = true;
        break;
      }
    }
    // Also try via command -v
    if (!ts_available) {
      ts_available = (system("command -v tree-sitter > /dev/null 2>&1") == 0);
    }
    if (!ts_available) {
      cerr << "[DGAT] tree-sitter not found. Install with: ./install.sh cli grammars configure" << endl;
    } else {
      cerr << "[DGAT] tree-sitter detected and available" << endl;
    }
  }
  if (!ts_available) {
    // Try fallback directly
    string lang = get_language_from_ext(file_path);
    if (!lang.empty()) {
      return extract_imports_fallback(content, lang);
    }
    return imports;
  }

  string query_output = run_tree_sitter_query(lang, file_path, content);

  if (query_output.empty()) {
    return extract_imports_fallback(content, lang);
  }

  istringstream iss(query_output);
  string line;
  unordered_set<string> seen;

  while (getline(iss, line)) {
    if (line.find("import") == string::npos) continue;

    // skip system includes - tree-sitter shows them as text: <...>
    if (line.find("text: <") != string::npos) {
      continue;
    }

    // extract from double quotes (e.g. #include "foo.h")
    size_t pos = 0;
    while (true) {
      size_t start = line.find('"', pos);
      if (start == string::npos) break;
      size_t end = line.find('"', start + 1);
      if (end == string::npos) break;
      string imp = line.substr(start + 1, end - start - 1);
      if (!imp.empty() && seen.find(imp) == seen.end()) {
        seen.insert(imp);
        imports.push_back(imp);
      }
      pos = end + 1;
    }

    // extract from backticks (tree-sitter uses backticks for text values)
    pos = 0;
    while (true) {
      size_t start = line.find('`', pos);
      if (start == string::npos) break;
      size_t end = line.find('`', start + 1);
      if (end == string::npos) break;
      string imp = line.substr(start + 1, end - start - 1);
      if (!imp.empty() && seen.find(imp) == seen.end()) {
        seen.insert(imp);
        imports.push_back(imp);
      }
      pos = end + 1;
    }
  }

  return imports;
}

vector<string> extract_imports_fallback(const string& content, const string& lang) {
  vector<string> imports;
  istringstream iss(content);
  string line;
  unordered_set<string> seen;

  auto add = [&](const string& imp) {
    if (!imp.empty() && seen.find(imp) == seen.end()) {
      seen.insert(imp);
      imports.push_back(imp);
    }
  };

  while (getline(iss, line)) {
    line = trim_copy(line);

    if (line.find('#') != string::npos) {
      line = line.substr(0, line.find('#'));
      line = trim_copy(line);
    }

    if (lang == "python") {
      if (line.rfind("from ", 0) == 0) {
        // from X.Y.Z import foo, bar  →  extract "X.Y.Z"
        // from . import foo  →  extract "."
        // from .X import foo  →  extract ".X"
        string rest = trim_copy(line.substr(5));
        size_t imp_pos = rest.find(" import ");
        if (imp_pos != string::npos) {
          string module = trim_copy(rest.substr(0, imp_pos));
          add(module);
        } else {
          add(rest);
        }
      } else if (line.rfind("import ", 0) == 0) {
        // import os  →  extract "os"
        // import os, sys  →  extract "os" and "sys"
        // import agent.utils  →  extract "agent.utils"
        string rest = trim_copy(line.substr(7));
        size_t comma_pos = 0;
        while (true) {
          size_t next = rest.find(',', comma_pos);
          string module = trim_copy(rest.substr(comma_pos, next == string::npos ? string::npos : next - comma_pos));
          if (!module.empty()) {
            // strip "as X" alias
            size_t as_pos = module.find(" as ");
            if (as_pos != string::npos) {
              module = trim_copy(module.substr(0, as_pos));
            }
            add(module);
          }
          if (next == string::npos) break;
          comma_pos = next + 1;
        }
      }
    } else if (lang == "c" || lang == "cpp") {
      if (line.rfind("#include", 0) == 0) {
        // only process local includes (quotes), skip system includes (angle brackets)
        size_t start = line.find('"');
        if (start != string::npos) {
          size_t end = line.find('"', start + 1);
          if (end != string::npos) add(line.substr(start + 1, end - start - 1));
        }
        // skip angle bracket system includes - don't add them
      }
    } else if (lang == "go") {
      if (line.rfind("import", 0) == 0) {
        if (line.front() == '"' && line.back() == '"') {
          add(line.substr(1, line.size() - 2));
        }
      }
    } else if (lang == "javascript" || lang == "typescript") {
      if (line.rfind("import ", 0) == 0) {
        size_t from_pos = line.find("from ");
        if (from_pos != string::npos) {
          size_t quote_start = line.find('"', from_pos + 5);
          if (quote_start != string::npos) {
            size_t quote_end = line.find('"', quote_start + 1);
            if (quote_end != string::npos) {
              string module = line.substr(quote_start + 1, quote_end - quote_start - 1);
              if (!module.empty()) add(module);
            }
          }
        } else {
          size_t quote_start = line.find('"');
          if (quote_start != string::npos) {
            size_t quote_end = line.find('"', quote_start + 1);
            if (quote_end != string::npos) {
              string module = line.substr(quote_start + 1, quote_end - quote_start - 1);
              if (!module.empty()) add(module);
            }
          }
        }
      }
    } else if (lang == "rust") {
      if (line.rfind("use ", 0) == 0) {
        add(line);
      }
    } else if (lang == "java") {
      if (line.rfind("import ", 0) == 0) {
        add(line.substr(7));
        trim_copy(line.substr(7));
      }
    } else if (lang == "ruby") {
      if (line.rfind("require", 0) == 0 || line.rfind("require_relative", 0) == 0) {
        add(line);
      }
    } else if (lang == "php") {
      if (line.rfind("use ", 0) == 0) {
        size_t semi = line.find(';');
        if (semi != string::npos) line = line.substr(0, semi);
        add(trim_copy(line.substr(3)));
      }
    } else if (lang == "ipython") {
      // treat as python — notebooks are python code in cells
      if (line.rfind("from ", 0) == 0) {
        string rest = trim_copy(line.substr(5));
        size_t imp_pos = rest.find(" import ");
        if (imp_pos != string::npos) {
          string module = trim_copy(rest.substr(0, imp_pos));
          add(module);
        } else {
          add(rest);
        }
      } else if (line.rfind("import ", 0) == 0) {
        string rest = trim_copy(line.substr(7));
        size_t comma_pos = 0;
        while (true) {
          size_t next = rest.find(',', comma_pos);
          string module = trim_copy(rest.substr(comma_pos, next == string::npos ? string::npos : next - comma_pos));
          if (!module.empty()) {
            size_t as_pos = module.find(" as ");
            if (as_pos != string::npos) {
              module = trim_copy(module.substr(0, as_pos));
            }
            add(module);
          }
          if (next == string::npos) break;
          comma_pos = next + 1;
        }
      }
    }
  }

  return imports;
}

vector<string> extract_imports(const string& file_path, const string& content) {
  // notebooks need special handling — parse json and extract from code cells
  string lang = get_language_from_ext(file_path);
  if (lang == "ipython") {
    ParsedNotebook nb = parse_notebook_file(file_path);
    if (nb.is_valid) return extract_notebook_imports(nb);
    return {};
  }

  vector<string> imports = extract_imports_via_tree_sitter(file_path, content);

  if (!imports.empty()) {
    return imports;
  }

  if (lang == "bash") {
    return extract_file_mentions(content, ".sh");
  }
  if (lang == "make" || file_path.find("Makefile") != string::npos) {
    return extract_file_mentions(content, "Makefile");
  }

  if (!lang.empty()) {
    return extract_imports_fallback(content, lang);
  }

  return imports;
}

string normalize_import_path(const string& imp, const string& src_file) {
  if (imp.empty()) return "";

  string normalized = imp;

  // strip quotes from local includes like "inja.hpp"
  if (normalized.front() == '"' && normalized.back() == '"') {
    normalized = normalized.substr(1, normalized.size() - 2);
  }

  // skip system includes like <bits/stdc++.h>
  if (normalized.front() == '<' && normalized.back() == '>') {
    return "";
  }

  // apply ts path aliases before anything else — "@/foo" → "frontend/src/foo"
  for (auto& [alias, resolved] : ts_path_aliases) {
    if (normalized.rfind(alias, 0) == 0) {
      normalized = resolved + normalized.substr(alias.size());
      break;
    }
  }

  // Python relative imports starting with . or ..
  // from . import X  →  module is "." (resolve against source dir)
  // from .utils import X  →  module is ".utils" (resolve against source dir)
  // from ..utils import X  →  module is "..utils" (resolve against source dir)
  if (normalized.size() > 0 && normalized[0] == '.') {
    string lang = get_language_from_ext(src_file);
    if (lang == "python") {
      // strip leading dots and count them for relative navigation
      size_t num_dots = 0;
      while (num_dots < normalized.size() && normalized[num_dots] == '.') num_dots++;
      string module_part = normalized.substr(num_dots);

      size_t slash = src_file.rfind('/');
      string src_dir = (slash != string::npos) ? src_file.substr(0, slash) : "";

      // navigate up num_dots - 1 parent directories
      for (size_t i = 1; i < num_dots; i++) {
        size_t last_slash = src_dir.rfind('/');
        if (last_slash != string::npos) {
          src_dir = src_dir.substr(0, last_slash);
        } else {
          src_dir = "";
        }
      }

      if (!module_part.empty()) {
        normalized = src_dir.empty() ? module_part : src_dir + "/" + module_part;
      } else {
        // bare "." means the package itself — use __init__.py in source dir
        normalized = src_dir.empty() ? "__init__" : src_dir + "/__init__";
      }

      // convert remaining dots to slashes
      for (auto& c : normalized) { if (c == '.') c = '/'; }

      fs::path p = fs::path(normalized).lexically_normal();
      return p.generic_string();
    }
  }

  // Python absolute dotted imports like "agent.skill_utils" → "agent/skill_utils"
  if (normalized.find('.') != string::npos) {
    string lang = get_language_from_ext(src_file);
    if (lang == "python") {
      for (auto& c : normalized) { if (c == '.') c = '/'; }
      fs::path p = fs::path(normalized).lexically_normal();
      return p.generic_string();
    }
  }

  // relative import — resolve against the importing file's dir
  if (normalized.rfind("./", 0) == 0 || normalized.rfind("../", 0) == 0) {
    size_t slash = src_file.rfind('/');
    string src_dir = (slash != string::npos) ? src_file.substr(0, slash) : ".";
    if (src_dir.empty()) src_dir = ".";
    normalized = src_dir + "/" + normalized;
  } else if (normalized.find('/') == string::npos) {
    // bare name like "inja.hpp" — resolve next to source file
    size_t slash = src_file.rfind('/');
    string src_dir = (slash != string::npos) ? src_file.substr(0, slash) : ".";
    if (src_dir.empty()) src_dir = ".";
    normalized = src_dir + "/" + normalized;
  }
  // else: already looks like a repo-relative path (alias was expanded above)

  // collapse ".." and "." so "frontend/src/components/../lib/utils" → "frontend/src/lib/utils"
  fs::path p = fs::path(normalized).lexically_normal();
  return p.generic_string();
}

string extract_fenced_block_or_raw(const string& input) {
  size_t fence_start = input.find("```");
  if (fence_start == string::npos) {
    return trim_copy(input);
  }

  size_t first_newline = input.find('\n', fence_start);
  if (first_newline == string::npos) {
    return trim_copy(input);
  }

  size_t fence_end = input.find("```", first_newline + 1);
  if (fence_end == string::npos) {
    return trim_copy(input);
  }

  return trim_copy(input.substr(first_newline + 1, fence_end - first_newline - 1));
}

bool is_likely_binary_file(const string& file_path) {
  ifstream infile(file_path, ios::binary);
  if (!infile.is_open()) return false;

  array<unsigned char, 4096> buffer{};
  infile.read(reinterpret_cast<char*>(buffer.data()), static_cast<streamsize>(buffer.size()));
  streamsize bytes_read = infile.gcount();

  if (bytes_read <= 0) return false;

  size_t suspicious = 0;
  for (streamsize i = 0; i < bytes_read; i++) {
    unsigned char c = buffer[i];
    if (c == 0) return true;

    if ((c < 0x09) || (c > 0x0D && c < 0x20)) {
      suspicious++;
    }
  }

  double suspicious_ratio = static_cast<double>(suspicious) / static_cast<double>(bytes_read);
  return suspicious_ratio > 0.30;
}

string sanitize_utf8(const string& input) {
  string output;
  output.reserve(input.size());

  size_t i = 0;
  while (i < input.size()) {
    unsigned char c = static_cast<unsigned char>(input[i]);

    if (c <= 0x7F) {
      output.push_back(static_cast<char>(c));
      i++;
      continue;
    }

    size_t seq_len = 0;
    if ((c & 0xE0) == 0xC0) seq_len = 2;
    else if ((c & 0xF0) == 0xE0) seq_len = 3;
    else if ((c & 0xF8) == 0xF0) seq_len = 4;
    else {
      output.push_back('?');
      i++;
      continue;
    }

    if (i + seq_len > input.size()) {
      output.push_back('?');
      break;
    }

    bool valid = true;
    for (size_t j = 1; j < seq_len; j++) {
      unsigned char cc = static_cast<unsigned char>(input[i + j]);
      if ((cc & 0xC0) != 0x80) {
        valid = false;
        break;
      }
    }

    if (valid) {
      uint32_t codepoint = 0;
      if (seq_len == 2) {
        codepoint = ((c & 0x1F) << 6) |
                    (static_cast<unsigned char>(input[i + 1]) & 0x3F);
        if (codepoint < 0x80) valid = false;
      } else if (seq_len == 3) {
        codepoint = ((c & 0x0F) << 12) |
                    ((static_cast<unsigned char>(input[i + 1]) & 0x3F) << 6) |
                    (static_cast<unsigned char>(input[i + 2]) & 0x3F);
        if (codepoint < 0x800 || (codepoint >= 0xD800 && codepoint <= 0xDFFF)) {
          valid = false;
        }
      } else {
        codepoint = ((c & 0x07) << 18) |
                    ((static_cast<unsigned char>(input[i + 1]) & 0x3F) << 12) |
                    ((static_cast<unsigned char>(input[i + 2]) & 0x3F) << 6) |
                    (static_cast<unsigned char>(input[i + 3]) & 0x3F);
        if (codepoint < 0x10000 || codepoint > 0x10FFFF) valid = false;
      }
    }

    if (valid) {
      output.append(input, i, seq_len);
      i += seq_len;
    } else {
      output.push_back('?');
      i++;
    }
  }

  return output;
}

string extract_assistant_text(const json& response_json) {
  if (!response_json.contains("choices") ||
      !response_json["choices"].is_array() ||
      response_json["choices"].empty()) {
    return "";
  }

  const auto& first_choice = response_json["choices"][0];
  if (!first_choice.contains("message") || !first_choice["message"].is_object()) {
    return "";
  }

  const auto& message = first_choice["message"];
  if (message.contains("content") && message["content"].is_string()) {
    string content = trim_copy(message["content"].get<string>());
    if (!content.empty()) return content;
  }

  if (message.contains("reasoning") && message["reasoning"].is_string()) {
    string reasoning = trim_copy(message["reasoning"].get<string>());
    if (!reasoning.empty()) return reasoning;
  }

  return "";
}

json tree_to_json(const TreeNode* node) {
  if (!node) return json::object();

  // Convert digest_t hash to hex string
  ostringstream hash_stream;
  hash_stream << std::hex << std::setfill('0')
              << std::setw(16) << node->hash.high64
              << std::setw(16) << node->hash.low64;
  string hash_str = hash_stream.str();

  json result = {
    {"name", node->name},
    {"version", node->version},
    {"hash", hash_str},
    {"abs_path", node->abs_path},
    {"rel_path", node->rel_path},
    {"is_file", node->is_file},
    {"description", node->description},
    {"error_traces", node->error_traces},
    {"depends_on", node->depends_on},
    {"depended_by", node->depended_by},
    {"children", json::array()}
  };

  for (const auto& child : node->children) {
    result["children"].push_back(tree_to_json(child.get()));
  }

  return result;
}

bool read_text_file(const fs::path& file_path, string& content) {
  ifstream infile(file_path);
  if (!infile.is_open()) {
    return false;
  }

  stringstream buffer;
  buffer << infile.rdbuf();
  content = buffer.str();
  return true;
}

string load_tree_gui_html() {
  vector<fs::path> candidates;

  const char* env_html = getenv("DGAT_GUI_HTML");
  if (env_html && *env_html) {
    candidates.emplace_back(env_html);
  }

  candidates.emplace_back("dgat_gui.html");
  candidates.emplace_back("tree_gui.html");
  candidates.emplace_back("assets/dgat_gui.html");
  candidates.emplace_back("assets/tree_gui.html");
  candidates.emplace_back("../dgat_gui.html");
  candidates.emplace_back("../tree_gui.html");
  candidates.emplace_back("../assets/dgat_gui.html");
  candidates.emplace_back("../assets/tree_gui.html");
  candidates.emplace_back("/usr/local/share/dgat/dgat_gui.html");
  candidates.emplace_back("/usr/local/share/dgat/tree_gui.html");
  candidates.emplace_back("/usr/share/dgat/dgat_gui.html");
  candidates.emplace_back("/usr/share/dgat/tree_gui.html");

  string html;
  for (const auto& path : candidates) {
    if (read_text_file(path, html)) {
      return html;
    }
  }

  return R"HTML(<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DGAT</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; padding: 24px; background: #FAFAFA; color: #1A1A1A; }
    .box { max-width: 760px; margin: 40px auto; padding: 20px; border: 1px solid #E5E7EB; border-radius: 12px; background: #FFFFFF; }
    code { color: #3B82F6; }
  </style>
</head>
<body>
  <div class="box">
    <h1>DGAT</h1>
    <p>Could not load GUI file. Create <code>dgat_gui.html</code> in the working directory, or set <code>DGAT_GUI_HTML</code> to a valid path.</p>
  </div>
</body>
</html>
)HTML";
}

// write file_tree.json and dep_graph.json to disk so we can reload them later
void save_state(const json& tree_json, const json& dep_graph_json) {
  {
    ofstream f("file_tree.json");
    if (!f.is_open()) { cerr << "[DGAT] failed to write file_tree.json" << endl; return; }
    f << tree_json.dump(2);
  }
  {
    ofstream f("dep_graph.json");
    if (!f.is_open()) { cerr << "[DGAT] failed to write dep_graph.json" << endl; return; }
    f << dep_graph_json.dump(2);
  }
  cout << "[DGAT] state saved to file_tree.json and dep_graph.json" << endl;
}

// load both state files — returns false if either is missing
bool load_state(json& tree_json, json& dep_graph_json) {
  {
    ifstream f("file_tree.json");
    if (!f.is_open()) { cerr << "[DGAT] file_tree.json not found — run dgat [path] first" << endl; return false; }
    try { tree_json = json::parse(f); } catch (const exception& e) {
      cerr << "[DGAT] failed to parse file_tree.json: " << e.what() << endl; return false;
    }
  }
  {
    ifstream f("dep_graph.json");
    if (!f.is_open()) { cerr << "[DGAT] dep_graph.json not found — run dgat [path] first" << endl; return false; }
    try { dep_graph_json = json::parse(f); } catch (const exception& e) {
      cerr << "[DGAT] failed to parse dep_graph.json: " << e.what() << endl; return false;
    }
  }
  return true;
}

// create a default .dgatignore if one doesn't exist yet
void ensure_dgatignore(const fs::path& root) {
  fs::path p = root / ".dgatignore";
  if (fs::exists(p)) return;

  ofstream f(p);
  if (!f.is_open()) { cerr << "[DGAT] failed to create .dgatignore" << endl; return; }

  f << "# .dgatignore — files and dirs to exclude from dgat analysis\n";
  f << "# syntax is the same as .gitignore\n";
  f << "#\n";
  f << "# examples:\n";
  f << "#   node_modules/\n";
  f << "#   *.min.js\n";
  f << "#   build/\n";
  f << "#   dist/\n";
  f << "\n";
  f << "# auto-generated dgat output files — skip these during analysis\n";
  f << "file_tree.json\n";
  f << "dep_graph.json\n";
  f << "dgat_blueprint.md\n";
  f << "tree_visualization.dot\n";
  f << "tree_visualization.png\n";

  cout << "[DGAT] created default .dgatignore" << endl;
}

// Forward declarations
string read_readme_content();
string extract_folder_structure();
size_t estimate_tokens(const string& text);
string chunk_content(const string& content, size_t max_tokens);
static const size_t MAX_CONTEXT_TOKENS = 25000;
static const size_t PROMPT_TOKEN_ESTIMATE = 2000;
static const size_t RESPONSE_TOKEN_BUFFER = 3000;

// same as populate_descriptions but operates on a pre-selected list instead of walking the whole tree
void populate_descriptions_selective(vector<TreeNode*>& nodes) {
  if (nodes.empty()) return;

  string rc = read_readme_content();
  string folder_structure = extract_folder_structure();

  cout << "[DGAT] Processing " << nodes.size() << " file descriptions (selective) with 8 workers..." << endl;

  const size_t NUM_THREADS = 8;
  mutex tree_mutex;
  atomic<int> processed{0};
  atomic<int> total{static_cast<int>(nodes.size())};

  ThreadPool pool(NUM_THREADS);
  vector<future<void>> futures;

  const string file_descriptor_prompt_template = R"J2(You are a senior software engineer doing a quick code review pass. Analyze the file below and write a short markdown description of what it does.

  {% if software_bluprint_details %}
  Project context:
  {{ software_bluprint_details_pretty }}
  {% endif %}

  {% if folder_structure %}
  Repo structure:
  {{ folder_structure }}
  {% endif %}

  {% if file_name %}
  File: `{{ file_name }}`
  {% endif %}

  {% if file_content %}
  Content:
  {{ file_content }}
  {% endif %}

  Return a JSON object with a single key `file_description` whose value is a compact markdown string. Analyse the filename too. Rules:
  - 3-6 lines max, no fluff
  - Start with one bold sentence saying what the file does (description of the file's purpose, analyzing the filename and content together).
  - Use a tight bullet list for key responsibilities (3-5 bullets max)
  - No intro text, no closing remarks, just the markdown)J2";

  json blueprint_json;
  try {
    blueprint_json = json::parse(rc);
  } catch (...) {
    blueprint_json = rc;
  }

  for (TreeNode* node : nodes) {
    futures.push_back(pool.enqueue([&, node, rc, folder_structure, blueprint_json]() {
      string file_content;

      // handle notebooks separately — use structured cell content
      if (get_language_from_ext(node->rel_path) == "jupyter") {
        ParsedNotebook nb = parse_notebook_file(node->abs_path);
        if (nb.is_valid) {
          file_content = notebook_to_description_content(nb);
        } else {
          lock_guard<mutex> lock(tree_mutex);
          node->description = string("skipped notebook: ") + nb.error_message;
          int count = ++processed;
          if (count % 5 == 0 || count == total) {
            float pct = (float)count / total * 100;
            cout << "\r[DGAT] File descriptions: " << count << "/" << total
                 << " (" << fixed << setprecision(1) << pct << "%)" << flush;
          }
          return;
        }
      } else if (is_likely_binary_file(node->abs_path)) {
        lock_guard<mutex> lock(tree_mutex);
        node->description = "Binary or non-text file skipped.";
        int count = ++processed;
        if (count % 5 == 0 || count == total) {
          float pct = (float)count / total * 100;
          cout << "\r[DGAT] File descriptions: " << count << "/" << total
               << " (" << fixed << setprecision(1) << pct << "%)" << flush;
        }
        return;
      } else {
        ifstream infile(node->abs_path, ios::binary);
        if (infile.is_open()) {
          stringstream buffer;
          buffer << infile.rdbuf();
          file_content = buffer.str();
          file_content = sanitize_utf8(file_content);

          size_t blueprint_tokens = estimate_tokens(rc);
          size_t folder_tokens = estimate_tokens(folder_structure);
          size_t available_tokens = MAX_CONTEXT_TOKENS - PROMPT_TOKEN_ESTIMATE - blueprint_tokens - folder_tokens - RESPONSE_TOKEN_BUFFER;

          if (available_tokens > 20000) available_tokens = 20000;
          if (available_tokens < 1000) available_tokens = 3000;

          file_content = chunk_content(file_content, available_tokens);
        }
      }

      digest_t hash = fast_fingerprint(file_content);

      json prompt_data = {
        {"software_bluprint_details", !rc.empty()},
        {"software_bluprint_details_pretty", blueprint_json.dump(2)},
        {"folder_structure", folder_structure},
        {"file_name", node->rel_path},
        {"file_content", file_content}
      };

      inja::Environment env;
      string rendered_prompt = env.render(file_descriptor_prompt_template, prompt_data);

      json request_payload = {
        {"model", "Qwen/Qwen3.5-2B"},
        {"messages", {
          {
            {"role", "user"},
            {"content", rendered_prompt}
          }
        }}
      };

      httplib::Client cli("localhost", 8000);
      auto res = cli.Post("/v1/chat/completions", request_payload.dump(), "application/json");

      lock_guard<mutex> lock(tree_mutex);

      node->hash = hash;

      if (res && res->status == 200) {
        try {
          json response_json = json::parse(res->body);
          string assistant_text = extract_assistant_text(response_json);
          if (assistant_text.empty()) {
            node->description = "Model returned no usable text payload.";
          } else {
            string json_candidate = extract_fenced_block_or_raw(assistant_text);
            try {
              json descriptor_json = json::parse(json_candidate);
              node->description = descriptor_json.value("file_description", assistant_text);
            } catch (...) {
              node->description = assistant_text;
            }
          }
        } catch (const std::exception& e) {
          cerr << "failed to parse response for file: " << node->rel_path << ". error: " << e.what() << endl;
        }
      } else {
        cerr << "response from vllm failed for file: " << node->rel_path << endl;
        if (res) cerr << "status code: " << res->status << endl;
      }

      int count = ++processed;
      if (count % 5 == 0 || count == total) {
        float pct = (float)count / total * 100;
        cout << "\r[DGAT] File descriptions: " << count << "/" << total
             << " (" << fixed << setprecision(1) << pct << "%)" << flush;
      }
    }));
  }

  for (auto& f : futures) f.get();
  cout << "\r[DGAT] File descriptions complete!                " << endl;
}

void run_tree_gui_server(TreeNode* root, const DepGraph& dep_graph, int port) {
  httplib::Server server;
  const string html = load_tree_gui_html();
  const json tree_json = tree_to_json(root);

  const json dep_graph_json = build_dep_graph_json(dep_graph);

  auto set_cors_headers = [](httplib::Response& response) {
    response.set_header("Access-Control-Allow-Origin", "*");
    response.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.set_header("Access-Control-Allow-Headers", "Content-Type");
  };

  server.Options("/(.*)", [](const httplib::Request&, httplib::Response& response) {
    response.set_header("Access-Control-Allow-Origin", "*");
    response.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.set_header("Access-Control-Allow-Headers", "Content-Type");
    response.status = 200;
  });

  server.Get("/", [html, set_cors_headers](const httplib::Request&, httplib::Response& response) {
    set_cors_headers(response);
    response.set_content(html, "text/html; charset=UTF-8");
  });

  server.Get("/api/tree", [tree_json, set_cors_headers](const httplib::Request&, httplib::Response& response) {
    set_cors_headers(response);
    response.set_content(tree_json.dump(), "application/json; charset=UTF-8");
  });

  server.Get("/api/dep-graph", [dep_graph_json, set_cors_headers](const httplib::Request&, httplib::Response& response) {
    set_cors_headers(response);
    response.set_content(dep_graph_json.dump(), "application/json; charset=UTF-8");
  });

  server.Get("/health", [set_cors_headers](const httplib::Request&, httplib::Response& response) {
    set_cors_headers(response);
    response.set_content("ok", "text/plain; charset=UTF-8");
  });

  // serve the blueprint markdown — frontend can render it in a panel
  server.Get("/api/blueprint", [set_cors_headers](const httplib::Request&, httplib::Response& response) {
    set_cors_headers(response);
    ifstream f("dgat_blueprint.md");
    if (!f.is_open()) {
      response.status = 404;
      response.set_content("blueprint not found", "text/plain; charset=UTF-8");
      return;
    }
    stringstream buf;
    buf << f.rdbuf();
    response.set_content(buf.str(), "text/plain; charset=UTF-8");
  });

  cout << "Interactive GUI running at: http://localhost:" << port << endl;
  cout << "Press Ctrl+C to stop." << endl;

  if (!server.listen("0.0.0.0", port)) {
    cerr << "Failed to start GUI server on port " << port << endl;
  }
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

string read_readme_content() {
  vector<string> readme_names = {"README.md", "README.txt", "README"};
  for (const auto& name : readme_names) {
    if (fs::exists(name) && fs::is_regular_file(name)) {
      ifstream infile(name);
      if (infile.is_open()) {
        stringstream buffer;
        buffer << infile.rdbuf();
        return buffer.str();
      }
    }
  }
  return "";
}

string extract_folder_structure() {
  // for now we can just run the tree command and capture its output as a string
  // this is a quick and dirty way to get a textual representation of the folder structure
  // later we can derive it from the tree we have constructed if needed, but this is good enough for now
  string cmd = "tree -a -I '.git|node_modules|__pycache__' -L 3"; // ignore common large folders and limit depth for readability
  array<char, 128> buffer;
  string result;

  auto close_pipe = [](FILE* stream) {
    if (stream) pclose(stream);
  };
  unique_ptr<FILE, decltype(close_pipe)> pipe(popen(cmd.c_str(), "r"), close_pipe);
  if (!pipe) {
    cerr << "Failed to run tree command" << endl;
    return "";
  }

  while (fgets(buffer.data(), buffer.size(), pipe.get()) != nullptr) {
    result += buffer.data();
  }

  return result;
}


size_t estimate_tokens(const string& text) {
  return text.size() / 4;
}

string chunk_content(const string& content, size_t max_tokens) {
  size_t max_chars = max_tokens * 4;
  if (content.size() <= max_chars) return content;

  size_t chunk_end = content.find("\n", max_chars / 2);
  if (chunk_end == string::npos || chunk_end > max_chars) {
    chunk_end = max_chars;
  }

  return content.substr(0, chunk_end) + "\n\n[Content truncated - file too large for context window]";
}

// next step is to populate the files with their description according to the content of the file
void collect_file_nodes(TreeNode* node, vector<TreeNode*>& files) {
  if (!node) return;
  if (node->is_file) {
    if (!matches_dgatignore(node->rel_path)) {
      files.push_back(node);
    }
  }
  for (auto& child : node->children) {
    collect_file_nodes(child.get(), files);
  }
}

void populate_descriptions(TreeNode* root) {
  string rc = read_readme_content();
  string folder_structure = extract_folder_structure();

  vector<TreeNode*> files;
  collect_file_nodes(root, files);

  if (files.empty()) {
    cout << "[DGAT] No files to process for descriptions." << endl;
    return;
  }

  cout << "[DGAT] Processing " << files.size() << " file descriptions with 8 workers..." << endl;

  const size_t NUM_THREADS = 8;
  mutex tree_mutex;
  atomic<int> processed{0};
  atomic<int> total{static_cast<int>(files.size())};

  ThreadPool pool(NUM_THREADS);
  vector<future<void>> futures;

  // prompt that asks the model to give back a tight markdown blurb — not an essay, just the useful stuff
  const string file_descriptor_prompt_template = R"J2(You are a senior software engineer doing a quick code review pass. Analyze the file below and write a short markdown description of what it does.

  {% if software_bluprint_details %}
  Project context:
  {{ software_bluprint_details_pretty }}
  {% endif %}

  {% if folder_structure %}
  Repo structure:
  {{ folder_structure }}
  {% endif %}

  {% if file_name %}
  File: `{{ file_name }}`
  {% endif %}

  {% if file_content %}
  Content:
  {{ file_content }}
  {% endif %}

  Return a JSON object with a single key `file_description` whose value is a compact markdown string. Analyse the filename too. Rules:
  - 3-6 lines max, no fluff
  - Start with one bold sentence saying what the file does (description of the file's purpose, analyzing the filename and content together).
  - Use a tight bullet list for key responsibilities (3-5 bullets max)
  - No intro text, no closing remarks, just the markdown)J2";

  json blueprint_json;
  try {
    blueprint_json = json::parse(rc);
  } catch (...) {
    blueprint_json = rc;
  }

  for (TreeNode* node : files) {
    futures.push_back(pool.enqueue([&, node, rc, folder_structure, blueprint_json]() {
      string file_content;

      // handle notebooks separately — use structured cell content
      if (get_language_from_ext(node->rel_path) == "jupyter") {
        ParsedNotebook nb = parse_notebook_file(node->abs_path);
        if (nb.is_valid) {
          file_content = notebook_to_description_content(nb);
        } else {
          lock_guard<mutex> lock(tree_mutex);
          node->description = string("skipped notebook: ") + nb.error_message;
          int count = ++processed;
          if (count % 5 == 0 || count == total) {
            float pct = (float)count / total * 100;
            cout << "\r[DGAT] File descriptions: " << count << "/" << total
                 << " (" << fixed << setprecision(1) << pct << "%)" << flush;
          }
          return;
        }
      } else if (is_likely_binary_file(node->abs_path)) {
        lock_guard<mutex> lock(tree_mutex);
        node->description = "Binary or non-text file skipped.";
        int count = ++processed;
        if (count % 5 == 0 || count == total) {
          float pct = (float)count / total * 100;
          cout << "\r[DGAT] File descriptions: " << count << "/" << total
               << " (" << fixed << setprecision(1) << pct << "%)" << flush;
        }
        return;
      } else {
        ifstream infile(node->abs_path, ios::binary);
        if (infile.is_open()) {
          stringstream buffer;
          buffer << infile.rdbuf();
          file_content = buffer.str();
          file_content = sanitize_utf8(file_content);

          size_t blueprint_tokens = estimate_tokens(rc);
          size_t folder_tokens = estimate_tokens(folder_structure);
          size_t available_tokens = MAX_CONTEXT_TOKENS - PROMPT_TOKEN_ESTIMATE - blueprint_tokens - folder_tokens - RESPONSE_TOKEN_BUFFER;

          if (available_tokens > 20000) available_tokens = 20000;
          if (available_tokens < 1000) available_tokens = 3000;

          file_content = chunk_content(file_content, available_tokens);
        }
      }

      digest_t hash = fast_fingerprint(file_content);

      json prompt_data = {
        {"software_bluprint_details", !rc.empty()},
        {"software_bluprint_details_pretty", blueprint_json.dump(2)},
        {"folder_structure", folder_structure},
        {"file_name", node->rel_path},
        {"file_content", file_content}
      };

      inja::Environment env;
      string rendered_prompt = env.render(file_descriptor_prompt_template, prompt_data);

      json request_payload = {
        {"model", "Qwen/Qwen3.5-2B"},
        {"messages", {
          {
            {"role", "user"},
            {"content", rendered_prompt}
          }
        }}
      };

      httplib::Client cli("localhost", 8000);
      auto res = cli.Post("/v1/chat/completions", request_payload.dump(), "application/json");

      lock_guard<mutex> lock(tree_mutex);

      node->hash = hash;

      if (res && res->status == 200) {
        try {
          json response_json = json::parse(res->body);
          string assistant_text = extract_assistant_text(response_json);
          if (assistant_text.empty()) {
            node->description = "Model returned no usable text payload.";
          } else {
            string json_candidate = extract_fenced_block_or_raw(assistant_text);
            try {
              json descriptor_json = json::parse(json_candidate);
              node->description = descriptor_json.value("file_description", assistant_text);
            } catch (...) {
              node->description = assistant_text;
            }
          }
        } catch (const std::exception& e) {
          cerr << "Failed to parse response for file: " << node->rel_path << ". Error: " << e.what() << endl;
        }
      } else {
        cerr << "response from vllm failed for file: " << node->rel_path << endl;
        if (res) {
          cerr << "status code: " << res->status << endl;
        }
      }

      int count = ++processed;
      if (count % 5 == 0 || count == total) {
        float pct = (float)count / total * 100;
        cout << "\r[DGAT] File descriptions: " << count << "/" << total
             << " (" << fixed << setprecision(1) << pct << "%)" << flush;
      }
    }));
  }

  for (auto& f : futures) {
    f.get();
  }

  cout << "\r[DGAT] File descriptions complete!                " << endl;
}

void create_dgat_blueprint(TreeNode* root){
  string root_path = root->abs_path;

  // except the readme.md, i just wanna collect all file descriptions and populate the blueprint of the full project, not relying on incomplete readme files

  const string blueprint_prompt_template = R"J2(You are a professional software architect. Read the file descriptions and write a clear software blueprint for this project.

  ### Folder Structure
  Project directory structure:
  {{ folder_structure }}

  ### File Descriptors
  File descriptions (purpose and behavior of each file):
  {{ file_descriptors_pretty }}

  Use simple and professional language. Keep only relevant information.

  Return ONLY markdown content (no JSON and no outer code fence) using this exact structure:

  # DGAT Software Blueprint

  ## Project Overview
  (short summary of what the project does)

  ## Architecture
  (main parts of the system and how they work together)

  ## Technical Details
  (important implementation details, limits, and notes))J2";

  vector<json> file_descriptors;

  function<void(TreeNode*)> collect_descriptors = [&](TreeNode* node) {
    if (!node) return;
    if (node->is_file) {
      file_descriptors.push_back({
        {"file_name", node->rel_path},
        {"description", node->description}
      });
    }
    for (const auto& child : node->children) {
      collect_descriptors(child.get());
    }
  };

  collect_descriptors(root);

  // Limit file descriptors to prevent token overflow
  const size_t MAX_DESCRIPTORS = 50;
  string descriptors_str;
  if (file_descriptors.size() > MAX_DESCRIPTORS) {
    vector<json> limited_descriptors(file_descriptors.begin(), file_descriptors.begin() + MAX_DESCRIPTORS);
    descriptors_str = json(limited_descriptors).dump(2);
    descriptors_str += "\n\n[... and " + to_string(file_descriptors.size() - MAX_DESCRIPTORS) + " more files ...]";
  } else {
    descriptors_str = json(file_descriptors).dump(2);
  }

  json prompt_data = {
    {"folder_structure", extract_folder_structure()},
    {"file_descriptors_pretty", descriptors_str}
  };

  inja::Environment env;
  string rendered_prompt = env.render(blueprint_prompt_template, prompt_data);

  // now we'll make request to vllm with this rendered prompt and get the response
  json request_payload = {
    {"model", "Qwen/Qwen3.5-2B"},
    {"messages", {
      {
        {"role", "user"},
        {"content", rendered_prompt}
      }
    }
  }};

  httplib::Client cli("localhost", 8000);
  auto res = cli.Post("/v1/chat/completions", request_payload.dump(), "application/json");

  if(res && res->status == 200){
    cout<<"response from vllm successful for blueprint generation"<<endl;
    cout<<"response body: "<<res->body<<endl;
  }else{
    cerr<<"response from vllm failed for blueprint generation"<<endl;
    if(res){
      cerr<<"status code: "<<res->status<<endl;
      cerr<<"response body: "<<res->body<<endl;
    }else{
      cerr<<"error code: "<<res.error()<<endl;
    }
  }

  if (!(res && res->status == 200)) return;

  string file_name = "dgat_blueprint.md";
  ofstream outfile(file_name);
  if(!outfile.is_open()){
    cerr<<"Failed to write DGAT blueprint to file: "<<file_name<<endl;
    return;
  }

  string markdown_output;
  try {
    json response_json = json::parse(res->body);
    string assistant_text = extract_assistant_text(response_json);
    if (assistant_text.empty()) {
      markdown_output = "# DGAT Software Blueprint\n\nModel returned no usable text payload.";
    } else {
      markdown_output = extract_fenced_block_or_raw(assistant_text);
    }
  } catch (const std::exception& e) {
    cerr << "Failed to parse blueprint response: " << e.what() << endl;
    markdown_output = "# DGAT Software Blueprint\n\nFailed to parse model response.";
  }

  if (trim_copy(markdown_output).empty()) {
    markdown_output = "# DGAT Software Blueprint\n\nModel returned empty markdown output.";
  }

  outfile << markdown_output;
  outfile.close();
  cout<<"DGAT blueprint written to: "<<file_name<<endl;
}

// backend mode — load state from disk and start the server, no llm calls
void run_backend_mode(int port) {
  json tree_json, dep_graph_json;
  if (!load_state(tree_json, dep_graph_json)) return;

  // build minimal in-memory tree and dep graph from json so we can reuse run_tree_gui_server
  // we pass nullptr for root since the server only needs the serialized json blobs
  // instead of threading through a full TreeNode tree, we use a json-only server path

  httplib::Server server;
  const string html = load_tree_gui_html();

  auto set_cors_headers = [](httplib::Response& response) {
    response.set_header("Access-Control-Allow-Origin", "*");
    response.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.set_header("Access-Control-Allow-Headers", "Content-Type");
  };

  server.Options("/(.*)", [](const httplib::Request&, httplib::Response& response) {
    response.set_header("Access-Control-Allow-Origin", "*");
    response.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.set_header("Access-Control-Allow-Headers", "Content-Type");
    response.status = 200;
  });

  server.Get("/", [html, set_cors_headers](const httplib::Request&, httplib::Response& response) {
    set_cors_headers(response);
    response.set_content(html, "text/html; charset=UTF-8");
  });

  server.Get("/api/tree", [tree_json, set_cors_headers](const httplib::Request&, httplib::Response& response) {
    set_cors_headers(response);
    response.set_content(tree_json.dump(), "application/json; charset=UTF-8");
  });

  server.Get("/api/dep-graph", [dep_graph_json, set_cors_headers](const httplib::Request&, httplib::Response& response) {
    set_cors_headers(response);
    response.set_content(dep_graph_json.dump(), "application/json; charset=UTF-8");
  });

  server.Get("/health", [set_cors_headers](const httplib::Request&, httplib::Response& response) {
    set_cors_headers(response);
    response.set_content("ok", "text/plain; charset=UTF-8");
  });

  server.Get("/api/blueprint", [set_cors_headers](const httplib::Request&, httplib::Response& response) {
    set_cors_headers(response);
    ifstream f("dgat_blueprint.md");
    if (!f.is_open()) {
      response.status = 404;
      response.set_content("blueprint not found", "text/plain; charset=UTF-8");
      return;
    }
    stringstream buf;
    buf << f.rdbuf();
    response.set_content(buf.str(), "text/plain; charset=UTF-8");
  });

  cout << "Interactive GUI running at: http://localhost:" << port << endl;
  cout << "Press Ctrl+C to stop." << endl;

  if (!server.listen("0.0.0.0", port)) {
    cerr << "Failed to start GUI server on port " << port << endl;
  }
}

// incremental update — re-describe only changed files, copy everything else from saved state
void run_update_mode(const fs::path& root_path) {
  load_gitignore(root_path);
  load_dgatignore(root_path);

  cout << "[DGAT] update mode — target: " << fs::absolute(root_path).string() << endl;

  // load old state to get stored hashes and descriptions
  json old_tree_json, old_dep_graph_json;
  if (!load_state(old_tree_json, old_dep_graph_json)) return;

  // build a flat map of rel_path -> {hash, description} from old tree
  unordered_map<string, string> old_hash;
  unordered_map<string, string> old_desc;
  function<void(const json&)> collect_old = [&](const json& node) {
    if (node.value("is_file", false)) {
      string rp = node.value("rel_path", "");
      if (!rp.empty()) {
        old_hash[rp] = node.value("hash", "");
        old_desc[rp]  = node.value("description", "");
      }
    }
    for (const auto& child : node.value("children", json::array())) {
      collect_old(child);
    }
  };
  collect_old(old_tree_json);

  // build fresh tree from filesystem
  cout << "[DGAT] building new file tree..." << endl;
  load_tsconfig_aliases(fs::current_path());
  auto root = build_tree(root_path, root_path);
  if (!root) { cerr << "[DGAT] failed to build tree" << endl; return; }

  // collect all current files and compute their hashes
  unordered_map<string, string> contents;
  unordered_map<string, TreeNode*> file_map;
  collect_source_files(root.get(), contents, file_map, true);

  unordered_set<string> changed_paths;
  for (auto& [rp, content] : contents) {
    digest_t d = fast_fingerprint(content);
    ostringstream oss;
    oss << hex << setfill('0') << setw(16) << d.high64 << setw(16) << d.low64;
    string new_hash = oss.str();

    auto it = old_hash.find(rp);
    if (it == old_hash.end() || it->second != new_hash) {
      changed_paths.insert(rp);
    } else {
      // hash unchanged — copy old description so we skip the llm call
      TreeNode* tn = file_map[rp];
      if (tn) {
        tn->description = old_desc.count(rp) ? old_desc[rp] : "";
        tn->hash = d;
      }
    }
  }

  if (changed_paths.empty()) {
    cout << "[DGAT] nothing changed" << endl;
    return;
  }

  cout << "[DGAT] " << changed_paths.size() << " changed file(s) — re-describing..." << endl;

  // collect TreeNode* for only the changed files
  vector<TreeNode*> changed_nodes;
  for (const auto& rp : changed_paths) {
    auto it = file_map.find(rp);
    if (it != file_map.end()) changed_nodes.push_back(it->second);
  }

  populate_descriptions_selective(changed_nodes);

  // rebuild dep graph — fast, no llm
  cout << "[DGAT] rebuilding dep graph..." << endl;
  DepGraph dep_graph = build_dep_graph(root.get());
  cout << "[DGAT] dep graph: " << dep_graph.nodes.size() << " nodes, " << dep_graph.edges.size() << " edges" << endl;

  // restore old node descriptions for nodes whose source file didn't change
  unordered_map<string, string> old_node_desc;
  for (const auto& n : old_dep_graph_json.value("nodes", json::array())) {
    old_node_desc[n.value("id", "")] = n.value("description", "");
  }
  for (auto& node : dep_graph.nodes) {
    if (!changed_paths.count(node.rel_path) && old_node_desc.count(node.rel_path)) {
      node.description = old_node_desc[node.rel_path];
    }
  }

  // re-describe only dep nodes that are external/gitignored AND were not already described above
  // (populate_dependency_descriptions already skips non-placeholder descs)
  populate_dependency_descriptions(dep_graph);

  // for edges: re-describe only where from or to is in changed set, copy old otherwise
  unordered_map<string, string> old_edge_desc;
  for (const auto& e : old_dep_graph_json.value("edges", json::array())) {
    string key = e.value("from", "") + "|||" + e.value("to", "");
    old_edge_desc[key] = e.value("description", "");
  }
  // first restore old descriptions for untouched edges
  for (auto& edge : dep_graph.edges) {
    bool touches_changed = changed_paths.count(edge.from_path) || changed_paths.count(edge.to_path);
    if (!touches_changed) {
      string key = edge.from_path + "|||" + edge.to_path;
      if (old_edge_desc.count(key)) edge.description = old_edge_desc[key];
    }
  }
  // now only re-describe edges touching changed files (we temporarily set a marker so the function skips the rest)
  // easiest approach: call populate_edge_descriptions which skips edges with placeholder node descs anyway
  populate_edge_descriptions(dep_graph);

  // sync dep info back to tree nodes
  for (const auto& node : dep_graph.nodes) {
    TreeNode* tn = find_node_by_path(root.get(), node.rel_path);
    if (tn) {
      tn->depends_on = node.depends_on;
      tn->depended_by = node.depended_by;
    }
  }

  // save updated state
  json new_tree_json = tree_to_json(root.get());
  json new_dep_json  = build_dep_graph_json(dep_graph);
  save_state(new_tree_json, new_dep_json);

  cout << "[DGAT] update complete" << endl;
}

int main(int argc, char** argv){
  fs::path root_path = ".";
  bool backend_mode = false;
  bool update_mode  = false;
  bool deps_only    = false;
  int  port = 8090;

  string provider = "vllm"; // default provider for llm calls
  string model = "Qwen/Qwen3.5-2B"; // default model

  for (int i = 1; i < argc; i++) {
    string arg = argv[i];

    if (arg == "--backend" || arg == "-b") {
      backend_mode = true;
    } else if (arg == "--deps-only") {
      deps_only = true;
    } else if (arg == "update") {
      update_mode = true;
    } else if (arg == "--port" && i + 1 < argc) {
      try {
        port = stoi(argv[++i]);
      } catch (...) {
        cerr << "invalid value for --port" << endl;
        return 1;
      }
    } else if (arg.rfind("--port=", 0) == 0) {
      try {
        port = stoi(arg.substr(7));
      } catch (...) {
        cerr << "invalid value for --port" << endl;
        return 1;
      }
    } else if (arg.front() != '-') {
      // non-flag, non-keyword arg is the root path
      root_path = arg;
    }
  }

  cout << "========================================" << endl;
  cout << "   DGAT - Dependency Graph as a Tool   " << endl;
  cout << "========================================" << endl;

  if (backend_mode) {
    cout << "[DGAT] backend mode — loading state and starting server on port " << port << endl;
    run_backend_mode(port);
    return 0;
  }

  if (update_mode) {
    cout << "[DGAT] update mode" << endl;
    run_update_mode(root_path);
    return 0;
  }

  // full scan mode
  load_gitignore(root_path);
  load_dgatignore(root_path);
  ensure_dgatignore(root_path);

  cout << "[DGAT] target: " << fs::absolute(root_path).string() << endl;
  cout << "[DGAT] building file tree..." << endl;
  auto root = build_tree(root_path, root_path);
  if (!root) {
    cerr << "[DGAT] error: failed to build tree from root path." << endl;
    return 1;
  }
  cout << "[DGAT] file tree built successfully." << endl;

  if (!deps_only) {
    cout << "[DGAT] populating file descriptions via vllm..." << endl;
    populate_descriptions(root.get());
    create_dgat_blueprint(root.get());
    cout << "[DGAT] file descriptions populated." << endl;
  } else {
    cout << "[DGAT] skipping file descriptions (--deps-only mode)" << endl;
  }

  // load tsconfig path aliases so "@/..." imports resolve to real paths
  load_tsconfig_aliases(fs::current_path());

  cout << "[DGAT] building dependency graph..." << endl;
  DepGraph dep_graph = build_dep_graph(root.get());
  cout << "[DGAT] dependency graph built: " << dep_graph.nodes.size() << " nodes, " << dep_graph.edges.size() << " edges" << endl;

  if (!deps_only) {
    cout << "[DGAT] populating dependency descriptions via vllm..." << endl;
    populate_dependency_descriptions(dep_graph);

    cout << "[DGAT] populating edge descriptions via vllm..." << endl;
    populate_edge_descriptions(dep_graph);
  }

  for (const auto& node : dep_graph.nodes) {
    TreeNode* tn = find_node_by_path(root.get(), node.rel_path);
    if (tn) {
      tn->depends_on = node.depends_on;
      tn->depended_by = node.depended_by;
    }
  }
  cout << "[DGAT] tree nodes updated with dependency info." << endl;

  print_dep_graph(dep_graph);

  // save state to disk — backend mode picks it up from here
  json tree_j = tree_to_json(root.get());
  json dep_j  = build_dep_graph_json(dep_graph);
  save_state(tree_j, dep_j);

  cout << "[DGAT] scan complete. run 'dgat --backend' to start the server." << endl;
  return 0;
}
