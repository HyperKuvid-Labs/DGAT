# Tree-Sitter Query Files

These `.scm` files contain tree-sitter queries for extracting imports/dependencies from various programming languages.

## Supported Languages

| Language | Query File | Captures |
|----------|------------|----------|
| C | `c.scm` | `#include` directives |
| C++ | `cpp.scm` | `#include` directives |
| Python | `python.scm` | `import`, `from ... import` |
| Go | `go.scm` | `import` blocks and declarations |
| JavaScript/TypeScript | `javascript.scm` | `import`, `require`, file paths |
| Rust | `rust.scm` | `use` declarations |
| Java | `java.scm` | `import` declarations |
| C# | `csharp.scm` | `using` directives |
| PHP | `php.scm` | `use` statements, static calls |
| Ruby | `ruby.scm` | `require`, `require_relative` |

## Installation

Query files are automatically installed with DGAT:
```bash
./install.sh
```

Or manually:
```bash
cp -r queries/ /usr/local/share/dgat/
```

## Customization

To add custom queries:
1. Find the appropriate `.scm` file
2. Add new capture patterns using tree-sitter query syntax
3. Test with: `tree-sitter query --scope source.<lang> <file.scm> <test_file>`

Example:
```scheme
; Add to python.scm to capture aliased imports
(import_statement
  name: (identifier) @import
  alias: (identifier) @alias)
```

## Fallback

If tree-sitter is not available, DGAT falls back to regex-based extraction in `extract_imports_fallback()`.
