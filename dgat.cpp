#include <bits/stdc++.h>
#include <filesystem>
#include <thread>
#include <mutex>
#include <atomic>
#include <functional>
#include <future>
#include <queue>
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
string sanitize_utf8(const string& input);
vector<string> extract_imports(const string& file_path, const string& content);
string normalize_import_path(const string& imp, const string& src_file);
bool is_path_in_gitignore(const string& rel_path);

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
  string description;
  bool is_gitignored;
  DepNode() : is_gitignored(false) {}
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

void collect_source_files(TreeNode* node, unordered_map<string, string>& contents, unordered_map<string, TreeNode*>& files) {
  if (!node) return;
  if (node->is_file) {
    string lang = get_language_from_ext(node->rel_path);
    if (!lang.empty()) {
      files[node->rel_path] = node;
      if (!is_likely_binary_file(node->abs_path)) {
        ifstream infile(node->abs_path);
        if (infile.is_open()) {
          stringstream buffer;
          buffer << infile.rdbuf();
          contents[node->rel_path] = sanitize_utf8(buffer.str());
        }
      }
    }
  }
  for (const auto& child : node->children) collect_source_files(child.get(), contents, files);
}

DepGraph build_dep_graph(TreeNode* root) {
  DepGraph graph;
  if (!root) return graph;

  unordered_map<string, string> contents;
  unordered_map<string, TreeNode*> files;
  cerr << "[DEBUG] Starting collect_source_files..." << endl;
  collect_source_files(root, contents, files);
  cerr << "[DEBUG] collect_source_files done. Files found: " << contents.size() << endl;

  unordered_set<string> known_files;
  for (const auto& [rel_path, _] : contents) {
    known_files.insert(rel_path);
  }

  size_t file_count = 0;
  for (const auto& [rel_path, content] : contents) {
    file_count++;
    if (file_count % 10 == 0) {
      cerr << "[DEBUG] Processing file " << file_count << ": " << rel_path << endl;
    }
    string lang = get_language_from_ext(rel_path);
    vector<string> imports = extract_imports(rel_path, content);

    for (const string& imp : imports) {
      if (is_stdlib_import(imp, lang)) {
        continue;
      }

      string norm = normalize_import_path(imp, rel_path);
      string edge_key = rel_path + "||" + norm;

      bool is_internal = known_files.count(norm) > 0 ||
                         (norm.find('/') == string::npos && (known_files.count(norm + ".h") > 0 || known_files.count(norm + ".hpp") > 0));

      if (!is_internal) {
        for (const auto& [file_path, _] : contents) {
          string fname = fs::path(file_path).filename().string();
          if (fname == norm || fname == norm + ".h" || fname == norm + ".hpp") {
            norm = file_path;
            is_internal = true;
            break;
          }
        }
      }

      if (!is_internal) {
        bool gitignored = is_path_in_gitignore(norm);
        if (!graph.path_to_node.count(norm)) {
          DepNode node;
          node.name = fs::path(norm).filename().string();
          node.rel_path = norm;
          node.description = gitignored ? "Gitignored dependency" : "External/stdlib dependency";
          node.is_gitignored = gitignored;
          graph.path_to_node[norm] = graph.nodes.size();
          graph.nodes.push_back(node);
        }

        DepEdge edge;
        edge.from_path = rel_path;
        edge.to_path = norm;
        edge.import_stmt = imp;
        graph.edges.push_back(edge);
      }
    }
  }

  return graph;
}

json build_dep_graph_json(const DepGraph& graph) {
  json result = json::object();
  result["nodes"] = json::array();
  result["edges"] = json::array();

  for (const auto& node : graph.nodes) {
    json n = {
      {"id", node.rel_path},
      {"name", node.name},
      {"description", node.description},
      {"is_gitignored", node.is_gitignored}
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
    {".py", "python"}, {".pyw", "python"},
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
  if (fs::exists("/usr/local/share/dgat/grammars")) {
    return "/usr/local/share/dgat/grammars";
  }
  if (fs::exists("/usr/share/dgat/grammars")) {
    return "/usr/share/dgat/grammars";
  }
  return "";
}

string run_tree_sitter_query(const string& lang, const string& file_path, const string& content) {
  fs::path query_file = fs::absolute("queries/") / (lang + ".scm");
  if (!fs::exists(query_file)) {
    return "";
  }

  string tmp_input = "/tmp/ts_input_" + to_string(time(nullptr)) + ".txt";
  ofstream tmp_out(tmp_input);
  tmp_out << content;
  tmp_out.close();

  string grammars_dir = get_grammars_dir();
  string cmd = "tree-sitter query";
  if (!grammars_dir.empty()) {
    cmd += " -p " + grammars_dir + "/node_modules/tree-sitter-" + lang;
  }
  cmd += " " + query_file.string() + " " + tmp_input + " 2>/dev/null";
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
    ts_available = (system("command -v tree-sitter > /dev/null 2>&1") == 0);
    if (!ts_available) {
      cerr << "[DGAT] tree-sitter not found. Install with: ./install.sh cli grammars configure" << endl;
    }
  }
  if (!ts_available) {
    return imports;
  }

  string query_output = run_tree_sitter_query(lang, file_path, content);
  if (query_output.empty()) {
    return imports;
  }

  istringstream iss(query_output);
  string line;
  unordered_set<string> seen;

  while (getline(iss, line)) {
    if (line.find(" import") == string::npos) continue;

    size_t start = line.rfind('"');
    if (start == string::npos) continue;

    size_t end = line.rfind('"', start - 1);
    if (end == string::npos) continue;

    string imp = line.substr(end + 1, start - end - 1);
    if (!imp.empty() && seen.find(imp) == seen.end()) {
      seen.insert(imp);
      imports.push_back(imp);
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
      if (line.rfind("import ", 0) == 0 || line.rfind("from ", 0) == 0) {
        add(line);
      }
    } else if (lang == "c" || lang == "cpp") {
      if (line.rfind("#include", 0) == 0) {
        size_t start = line.find('"');
        if (start != string::npos) {
          size_t end = line.find('"', start + 1);
          if (end != string::npos) add(line.substr(start + 1, end - start - 1));
        } else {
          start = line.find('<');
          if (start != string::npos) {
            size_t end = line.find('>', start + 1);
            if (end != string::npos) add(line.substr(start + 1, end - start - 1));
          }
        }
      }
    } else if (lang == "go") {
      if (line.rfind("import", 0) == 0) {
        if (line.front() == '"' && line.back() == '"') {
          add(line.substr(1, line.size() - 2));
        }
      }
    } else if (lang == "javascript" || lang == "typescript") {
      if (line.rfind("import ", 0) == 0) {
        add(line);
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
    }
  }

  return imports;
}

vector<string> extract_imports(const string& file_path, const string& content) {
  vector<string> imports = extract_imports_via_tree_sitter(file_path, content);

  if (!imports.empty()) {
    return imports;
  }

  string lang = get_language_from_ext(file_path);
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
  if (imp.front() == '<' || imp.front() == '"') return imp;
  if (imp.find('/') != string::npos) return imp;

  size_t dot_pos = src_file.rfind('/');
  string src_dir = (dot_pos != string::npos) ? src_file.substr(0, dot_pos) : ".";
  if (src_dir.empty()) src_dir = ".";

  return src_dir + "/" + imp;
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

void run_tree_gui_server(TreeNode* root, const DepGraph& dep_graph, int port) {
  httplib::Server server;
  const string html = load_tree_gui_html();
  const json tree_json = tree_to_json(root);

  const json dep_graph_json = build_dep_graph_json(dep_graph);

  server.Get("/", [html](const httplib::Request&, httplib::Response& response) {
    response.set_content(html, "text/html; charset=UTF-8");
  });

  server.Get("/api/tree", [tree_json](const httplib::Request&, httplib::Response& response) {
    response.set_content(tree_json.dump(), "application/json; charset=UTF-8");
  });

  server.Get("/api/dep-graph", [dep_graph_json](const httplib::Request&, httplib::Response& response) {
    response.set_content(dep_graph_json.dump(), "application/json; charset=UTF-8");
  });

  server.Get("/health", [](const httplib::Request&, httplib::Response& response) {
    response.set_content("ok", "text/plain; charset=UTF-8");
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

const size_t MAX_CONTEXT_TOKENS = 32000;
const size_t PROMPT_TOKEN_ESTIMATE = 1500;
const size_t RESPONSE_TOKEN_BUFFER = 2000;

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
void populate_descriptions(TreeNode* node, string rc="", string folder_structure="") {
  if (!node) return;

  // Skip files matching .dgatignore patterns
  if (node->is_file && matches_dgatignore(node->rel_path)) {
    node->description = "Ignored by .dgatignore";
    return;
  }

  // check for readme file, and treat it like the context of the whole project
  if(rc == "") rc = read_readme_content();
  if(folder_structure == "") folder_structure = extract_folder_structure();
  if(!node->is_file){
    for(auto& child : node->children) populate_descriptions(child.get(), rc, folder_structure);
    return;
  }

  // here we will make the request to vllm and update the description of the file
  string file_content;
  if(node->is_file){
    if (is_likely_binary_file(node->abs_path)) {
      node->description = "Binary or non-text file skipped.";
      cout<<"description for file "<<node->rel_path<<": "<<node->description<<endl;
      return;
    }

    ifstream infile(node->abs_path, ios::binary);
    if (infile.is_open()) {
      stringstream buffer;
      buffer << infile.rdbuf();
      file_content = buffer.str();

      file_content = sanitize_utf8(file_content);

      size_t blueprint_tokens = estimate_tokens(rc);
      size_t folder_tokens = estimate_tokens(folder_structure);
      size_t available_tokens = MAX_CONTEXT_TOKENS - PROMPT_TOKEN_ESTIMATE - blueprint_tokens - folder_tokens - RESPONSE_TOKEN_BUFFER;
      
      if (available_tokens < 1000) available_tokens = 5000;
      
      file_content = chunk_content(file_content, available_tokens);
    }
  }

  digest_t hash = fast_fingerprint(file_content);
  node->hash = hash;

  const string file_descriptor_prompt_template = R"J2(You are an exceptional Principal Software Architect with deep expertise in software design and architecture. Your task is to analyze the user's request and generate a detailed file descriptor for a specific file within the project. This descriptor should include both the precise metadata description of its purpose and functionality and language used.

  {% if software_bluprint_details %}
  ### Software Blueprint Details
  The file you are generating should align with the following core project specifications:
  {{ software_bluprint_details_pretty }}
  {% endif %}

  {% if folder_structure %}
  ### Folder Structure
  The file should be placed within the following directory structure:
  {{ folder_structure }}
  {% endif %}

  {% if file_name %}
  ### Target File
  The file you need to generate is located at: `{{ file_name }}`
  {% endif %}

  {% if file_content %}
  ### File Content
  Use the following source content while generating the descriptor:
  {{ file_content }}
  {% endif %}

  Return the following in a neatly formatted JSON structure:
  - `file_description`: A precise, 1-2 sentence technical description of the file's purpose and functionality.
  - `language`: The programming language used in the file (e.g., Python, C++, etc.).)J2";

  json blueprint_json;
  try {
    blueprint_json = json::parse(rc);
  } catch (...) {
    blueprint_json = rc;
  }

  json prompt_data = {
    {"software_bluprint_details", !rc.empty()},
    {"software_bluprint_details_pretty", blueprint_json.dump(2)},
    {"folder_structure", folder_structure},
    {"file_name", node->rel_path},
    {"file_content", file_content}
  };

  inja::Environment env;
  string rendered_prompt = env.render(file_descriptor_prompt_template, prompt_data);

  // now we'll make request to vllm with this rendered prompt and get the response
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

  if(res && res->status == 200){
    cout<<"response from vllm successful for file: "<<node->rel_path<<endl;
    // cout<<"response body: "<<res->body<<endl;
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
  }else{
    cerr<<"response from vllm failed for file: "<<node->rel_path<<endl;
    if(res){
      cerr<<"status code: "<<res->status<<endl;
      cerr<<"response body: "<<res->body<<endl;
    }else{
      cerr<<"error code: "<<res.error()<<endl;
    }
  }

  cout<<"description for file "<<node->rel_path<<": "<<node->description<<endl;
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

  json prompt_data = {
    {"folder_structure", extract_folder_structure()},
    {"file_descriptors_pretty", json(file_descriptors).dump(2)}
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

int main(int argc, char** argv){
  fs::path root_path = ".";
  bool gui_mode = true;
  int gui_port = 8090;

  for (int i = 1; i < argc; i++) {
    string arg = argv[i];

    if (arg == "--gui") {
      gui_mode = true;
    } else if (arg == "--port" && i + 1 < argc) {
      try {
        gui_port = stoi(argv[++i]);
      } catch (...) {
        cerr << "Invalid value for --port" << endl;
        return 1;
      }
    } else if (arg.rfind("--port=", 0) == 0) {
      try {
        gui_port = stoi(arg.substr(7));
      } catch (...) {
        cerr << "Invalid value for --port" << endl;
        return 1;
      }
    } else {
      root_path = arg;
    }
  }

  load_gitignore(root_path);
  load_dgatignore(root_path);

  cout << "========================================" << endl;
  cout << "   DGAT - Dependency Graph as a Tool   " << endl;
  cout << "========================================" << endl;
  cout << "[DGAT] Target: " << fs::absolute(root_path).string() << endl;
  cout << "[DGAT] Building file tree..." << endl;
  auto root = build_tree(root_path, root_path);
  if (!root) {
    cerr << "[DGAT] Error: Failed to build tree from root path." << endl;
    return 1;
  }
  cout << "[DGAT] File tree built successfully." << endl;

  const string dot_file = "tree_visualization.dot";
  if (!export_tree_as_dot(root.get(), dot_file)) {
    cerr << "[DGAT] Error: Failed to write visualization file: " << dot_file << endl;
    return 1;
  }
  cout << "[DGAT] Tree DOT file written to: " << dot_file << endl;

  int dot_available = system("command -v dot > /dev/null 2>&1");
  if (dot_available == 0) {
    const string png_file = "tree_visualization.png";
    string render_cmd = "dot -Tpng " + dot_file + " -o " + png_file;
    if (system(render_cmd.c_str()) == 0) {
      cout << "[DGAT] Tree PNG visualization written to: " << png_file << endl;
    } else {
      cerr << "[DGAT] Warning: Failed to render PNG from DOT file" << endl;
    }
  } else {
    cout << "[DGAT] Info: Graphviz not found. Install 'dot' to render PNG visualization." << endl;
  }

  cout << "[DGAT] Populating file descriptions via vllm..." << endl;
  populate_descriptions(root.get());
  create_dgat_blueprint(root.get());
  cout << "[DGAT] File descriptions populated." << endl;

  cout << "[DGAT] Building dependency graph..." << endl;
  DepGraph dep_graph = build_dep_graph(root.get());
  cout << "[DGAT] Dependency graph built: " << dep_graph.nodes.size() << " nodes, " << dep_graph.edges.size() << " edges" << endl;
  print_dep_graph(dep_graph);

  if (gui_mode) {
    cout << "[DGAT] Starting GUI server on port " << gui_port << "..." << endl;
    run_tree_gui_server(root.get(), dep_graph, gui_port);
    return 0;
  }

  return 0;
}