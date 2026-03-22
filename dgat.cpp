#include <bits/stdc++.h>
#include <filesystem>
#include "inja.hpp"
#include "json.hpp"
#include "httplib.h"
#include "xxhash.h"

using namespace std;
using json = nlohmann::json;
namespace fs = std::filesystem;

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

string build_tree_gui_html() {
  return R"HTML(<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DGAT Tree Visualizer</title>
  <style>
    :root {
      --bg: #0b0b0d;
      --panel: #141418;
      --panel-alt: #1d1d23;
      --text: #efefef;
      --muted: #a4a7b0;
      --accent: #6ea8fe;
      --folder: #f5c45a;
      --file: #77e4c8;
      --border: #2a2a33;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: 14px;
    }

    .card {
      background: linear-gradient(180deg, var(--panel), var(--panel-alt));
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      min-height: 82vh;
    }

    .header {
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .title {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.2px;
    }

    .subtle {
      color: var(--muted);
      font-size: 12px;
    }

    .controls {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }

    button {
      background: #1f2330;
      color: var(--text);
      border: 1px solid #323646;
      border-radius: 8px;
      padding: 7px 10px;
      cursor: pointer;
      font-size: 12px;
    }

    button:hover { border-color: var(--accent); }

    input[type="search"] {
      flex: 1;
      min-width: 170px;
      background: #111219;
      border: 1px solid #303342;
      border-radius: 8px;
      color: var(--text);
      padding: 7px 10px;
      font-size: 12px;
      outline: none;
    }

    input[type="search"]:focus { border-color: var(--accent); }

    .tree-wrap {
      padding: 10px 14px 16px;
      max-height: calc(82vh - 112px);
      overflow: auto;
    }

    ul.tree,
    ul.tree ul {
      list-style: none;
      margin: 0;
      padding-left: 18px;
      border-left: 1px dashed #2b2f3f;
    }

    ul.tree { border-left: none; padding-left: 2px; }

    .node {
      margin: 3px 0;
    }

    .row {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid transparent;
      border-radius: 8px;
      padding: 4px 6px;
      cursor: pointer;
      user-select: none;
    }

    .row:hover { border-color: #2f3a55; background: #181b26; }
    .row.active { border-color: var(--accent); background: #1b2336; }

    .caret {
      width: 13px;
      text-align: center;
      color: var(--muted);
      font-size: 10px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.2px;
      color: #0d0f15;
    }

    .badge.folder { background: var(--folder); }
    .badge.file { background: var(--file); }

    .name {
      font-size: 12px;
      font-weight: 600;
      color: var(--text);
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .details {
      padding: 14px 16px;
      overflow: auto;
      max-height: calc(82vh - 55px);
      font-size: 13px;
      line-height: 1.5;
    }

    .kv {
      margin-bottom: 11px;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 9px 10px;
      background: #12141c;
    }

    .k {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 4px;
    }

    .v {
      word-break: break-word;
      color: var(--text);
      font-size: 13px;
    }

    .muted {
      color: var(--muted);
      font-style: italic;
    }

    .hidden { display: none; }

    @media (max-width: 980px) {
      .container {
        grid-template-columns: 1fr;
      }

      .card {
        min-height: auto;
      }

      .tree-wrap,
      .details {
        max-height: 55vh;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <section class="card">
      <div class="header">
        <h1 class="title">Tree Nodes</h1>
        <span class="subtle" id="nodeCount">0 nodes</span>
      </div>
      <div class="controls">
        <button id="expandAll">Expand All</button>
        <button id="collapseAll">Collapse All</button>
        <input id="search" type="search" placeholder="Search by file/folder name..." />
      </div>
      <div class="tree-wrap">
        <ul id="tree" class="tree"></ul>
      </div>
    </section>

    <section class="card">
      <div class="header">
        <h2 class="title">Node Details</h2>
        <span class="subtle">select a node</span>
      </div>
      <div class="details" id="details">
        <div class="muted">No node selected.</div>
      </div>
    </section>
  </div>

  <script>
    const treeRootEl = document.getElementById('tree');
    const detailsEl = document.getElementById('details');
    const nodeCountEl = document.getElementById('nodeCount');
    const searchEl = document.getElementById('search');
    const expandAllBtn = document.getElementById('expandAll');
    const collapseAllBtn = document.getElementById('collapseAll');

    let totalNodes = 0;
    let activeRow = null;

    function safeText(v) {
      if (v === null || v === undefined) return '';
      return String(v);
    }

    function setDetails(node) {
      const traces = Array.isArray(node.error_traces) ? node.error_traces : [];
      const description = safeText(node.description).trim();

      detailsEl.innerHTML = `
        <div class="kv"><div class="k">Name</div><div class="v">${safeText(node.name) || '-'}</div></div>
        <div class="kv"><div class="k">Type</div><div class="v">${node.is_file ? 'File' : 'Folder'}</div></div>
        <div class="kv"><div class="k">Relative Path</div><div class="v">${safeText(node.rel_path) || '-'}</div></div>
        <div class="kv"><div class="k">Absolute Path</div><div class="v">${safeText(node.abs_path) || '-'}</div></div>
        <div class="kv"><div class="k">Version</div><div class="v">${safeText(node.version)}</div></div>
        <div class="kv"><div class="k">Hash</div><div class="v">${safeText(node.hash) || '-'}</div></div>
        <div class="kv"><div class="k">Description</div><div class="v">${description || '-'}</div></div>
        <div class="kv"><div class="k">Error Traces</div><div class="v">${traces.length ? safeText(JSON.stringify(traces, null, 2)) : 'None'}</div></div>
      `;
    }

    function makeNodeElement(node) {
      totalNodes += 1;
      const li = document.createElement('li');
      li.className = 'node';

      const row = document.createElement('div');
      row.className = 'row';
      row.dataset.name = safeText(node.name).toLowerCase();

      const hasChildren = Array.isArray(node.children) && node.children.length > 0;
      const caret = document.createElement('span');
      caret.className = 'caret';
      caret.textContent = hasChildren ? '▾' : '·';

      const badge = document.createElement('span');
      badge.className = `badge ${node.is_file ? 'file' : 'folder'}`;
      badge.textContent = node.is_file ? 'FILE' : 'FOLDER';

      const name = document.createElement('span');
      name.className = 'name';
      name.title = `${safeText(node.name)}  (${safeText(node.rel_path)})`;
      name.textContent = safeText(node.name);

      row.appendChild(caret);
      row.appendChild(badge);
      row.appendChild(name);
      li.appendChild(row);

      let childList = null;
      if (hasChildren) {
        childList = document.createElement('ul');
        for (const child of node.children) {
          childList.appendChild(makeNodeElement(child));
        }
        li.appendChild(childList);
      }

      row.addEventListener('click', (event) => {
        event.stopPropagation();
        if (activeRow) activeRow.classList.remove('active');
        activeRow = row;
        row.classList.add('active');
        setDetails(node);

        if (!childList) return;
        const hidden = childList.classList.toggle('hidden');
        caret.textContent = hidden ? '▸' : '▾';
      });

      return li;
    }

    function setAllExpanded(expanded) {
      const allLists = treeRootEl.querySelectorAll('ul');
      const allCarets = treeRootEl.querySelectorAll('.caret');
      allLists.forEach((list) => {
        list.classList.toggle('hidden', !expanded);
      });
      allCarets.forEach((caret) => {
        if (caret.textContent !== '·') caret.textContent = expanded ? '▾' : '▸';
      });
    }

    function applySearch(query) {
      const q = safeText(query).trim().toLowerCase();
      const rows = treeRootEl.querySelectorAll('.row');

      rows.forEach((row) => {
        const match = q.length === 0 || row.dataset.name.includes(q);
        const nodeLi = row.closest('li.node');
        if (nodeLi) nodeLi.style.display = match ? '' : 'none';
      });
    }

    async function bootstrap() {
      const response = await fetch('/api/tree');
      if (!response.ok) throw new Error(`Failed to fetch tree: ${response.status}`);
      const treeData = await response.json();

      totalNodes = 0;
      treeRootEl.innerHTML = '';
      treeRootEl.appendChild(makeNodeElement(treeData));
      nodeCountEl.textContent = `${totalNodes} nodes`;

      setDetails(treeData);
      const firstRow = treeRootEl.querySelector('.row');
      if (firstRow) {
        activeRow = firstRow;
        firstRow.classList.add('active');
      }
    }

    expandAllBtn.addEventListener('click', () => setAllExpanded(true));
    collapseAllBtn.addEventListener('click', () => setAllExpanded(false));
    searchEl.addEventListener('input', () => applySearch(searchEl.value));

    bootstrap().catch((err) => {
      detailsEl.innerHTML = `<div class="muted">${safeText(err.message)}</div>`;
    });
  </script>
</body>
</html>
)HTML";
}

void run_tree_gui_server(TreeNode* root, int port) {
  httplib::Server server;
  const string html = build_tree_gui_html();
  const json tree_json = tree_to_json(root);

  server.Get("/", [html](const httplib::Request&, httplib::Response& response) {
    response.set_content(html, "text/html; charset=UTF-8");
  });

  server.Get("/api/tree", [tree_json](const httplib::Request&, httplib::Response& response) {
    response.set_content(tree_json.dump(), "application/json; charset=UTF-8");
  });

  server.Get("/health", [](const httplib::Request&, httplib::Response& response) {
    response.set_content("ok", "text/plain; charset=UTF-8");
  });

  cout << "Interactive tree GUI running at: http://localhost:" << port << endl;
  cout << "Press Ctrl+C to stop the GUI server." << endl;

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

// next step is to populate the files with their description according to the content of the file
void populate_descriptions(TreeNode* node, string rc="", string folder_structure="") {
  if (!node) return;

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

      const size_t max_file_content_size = 50 * 1024;
      if (file_content.size() > max_file_content_size) {
        file_content.resize(max_file_content_size);
        file_content += "\n\n[TRUNCATED: file content exceeded 50KB]";
      }

      file_content = sanitize_utf8(file_content);
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
    cout<<"response body: "<<res->body<<endl;
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
  int gui_port = 8080;

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

  populate_descriptions(root.get());
  create_dgat_blueprint(root.get());

  // update_tree();

  if (gui_mode) {
    run_tree_gui_server(root.get(), gui_port);
    return 0;
  }

  return 0;
}