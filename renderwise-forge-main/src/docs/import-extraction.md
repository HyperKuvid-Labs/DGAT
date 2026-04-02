# Import Extraction

The dependency graph is only as good as the import extraction. If DGAT misses an import, that edge doesn't exist in the graph. If it picks up false positives, the graph gets noisy. Getting this right matters.

DGAT uses a two-tier approach: tree-sitter for precision, regex fallbacks for coverage.

## Tier 1: Tree-sitter

When tree-sitter is available and a grammar exists for the file's language, DGAT uses it to parse the AST and extract imports directly from the syntax tree. This is the most accurate method — it understands the difference between `import foo from 'bar'` and a string literal that happens to contain the word "import."

### How it works

1. Detect the language from the file extension via `get_language_from_ext()`
2. Look up the corresponding `.scm` query file in the queries directory
3. Run `tree-sitter query` against the file with that query
4. Parse the output — extract import paths from quoted strings and backticks in the query results
5. Skip system includes (lines containing `text: <...>`)

The query files live in the `queries/` directory, one per language (e.g., `python.scm`, `typescript.scm`). These define the AST patterns that match import statements for each language.

### Grammar discovery

Grammars are found through multiple paths:
- `DGAT_GRAMMARS_DIR` environment variable
- Local `grammars/` directory
- Binary-relative paths (`../share/dgat/grammars`)
- System paths (`/usr/local/share/dgat/grammars`, `/usr/share/dgat/grammars`)

If tree-sitter isn't found on the system, the engine falls back to regex parsing.

## Tier 2: Regex fallback

When tree-sitter isn't available or returns empty results, DGAT uses language-specific regex patterns to extract imports. This is less precise but covers the common cases.

### Python

```python
from module.submodule import thing   → "module.submodule"
from . import thing                  → "."
from .utils import thing             → ".utils"
from ..models import User            → "..models"
import os                            → "os"
import os, sys                       → "os", "sys"
import agent.utils                   → "agent.utils"
import agent.utils as au             → "agent.utils"
```

Handles:
- `from X import Y` — extracts the module path
- `import X` — extracts module names, including comma-separated lists
- Relative imports with leading dots
- `as` aliases are stripped

### C / C++

```c
#include "local.h"    → "local.h"
#include <system.h>   → skipped (system include)
```

Only processes quoted includes — angle bracket includes are system headers and get filtered out.

### Go

```go
import "fmt"          → "fmt"
```

Single-line imports only in the fallback. Multi-line import blocks are handled by tree-sitter.

### JavaScript / TypeScript

```javascript
import { foo } from './utils'    → "./utils"
import foo from 'bar'            → "bar"
import './styles.css'            → "./styles.css"
```

Extracts the module specifier from `from '...'` or bare `import '...'` statements.

### Other languages

Rust (`use`), Java (`import`), Ruby (`require`/`require_relative`), PHP (`use`) — each has a basic pattern that catches the common form.

## Import path normalization

After extraction, import paths need to be resolved to actual files in the project. This is where things get interesting, because different ecosystems use different conventions.

### TypeScript path aliases

Modern TypeScript projects use path aliases in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/components/*": ["./src/components/*"],
      "@utils/*": ["./src/utils/*"]
    }
  }
}
```

DGAT walks the project looking for `tsconfig.json` or `jsconfig.json`, parses the `compilerOptions.paths` map, and builds an alias lookup. When it sees `@/components/Foo`, it resolves it to `frontend/src/components/Foo` (or wherever the config says).

The resolver:
1. BFS from root, stops at first `tsconfig.json` / `jsconfig.json`
2. Parses `compilerOptions.paths` (with JSON comment support)
3. Strips `/*` wildcards from both alias and target
4. Prefixes targets with the config file's directory (for monorepos where tsconfig lives in a subdirectory)
5. Stores as `alias → resolved_prefix` map

### Python relative imports

```python
from . import foo          → current package
from .. import foo         → parent package
from ..utils import foo    → parent package's utils module
```

The resolver:
1. Counts leading dots to determine how many levels to go up
2. Navigates up from the source file's directory
3. Converts remaining dots to slashes (`agent.utils` → `agent/utils`)
4. Uses `fs::path::lexically_normal()` to collapse `..` segments

### Relative path resolution

```
./utils       → resolve against source file's directory
../utils      → resolve against parent of source file's directory
utils         → bare name, resolve next to source file
```

The resolver prepends the source file's directory to relative imports, then normalizes the path.

### Extension trial

When an import path doesn't have an extension, DGAT tries common extensions in order:

```
"", ".py", ".tsx", ".ts", ".jsx", ".js", ".css", ".scss", ".h", ".hpp"
```

This covers `import utils` → `utils.ts`, `import helpers` → `helpers.py`, etc.

### Barrel files

TypeScript/JavaScript projects often re-export from `index.ts` files:

```
import { Foo } from './components'  → './components/index.ts'
```

After the extension trial fails, DGAT tries `path/index.tsx`, `path/index.ts`, `path/index.jsx`, `path/index.js`.

### Python `__init__.py`

Same concept for Python packages:

```
from .components import Foo  → './components/__init__.py'
```

### Filename-only match (last resort)

If nothing else works, DGAT tries matching just the filename against all known files in the project. This catches C/C++ header-only scenarios where `#include "utils"` should resolve to `src/utils.h`.

## What gets filtered out

Not every import becomes a graph edge. DGAT filters out:

- **Standard library imports** — `os`, `sys`, `json`, `stdio.h`, etc. These are tracked in a hardcoded `python_stdlib` set (and similar for other languages). No point mapping the standard library.
- **System includes** — anything in angle brackets `<vector>`, `<iostream>`. These are external to the project.
- **`__SYSTEM_INCLUDE__` prefixed imports** — a marker used internally to flag system-level includes.
- **Dependency manifest files** — `package.json`, `Cargo.toml`, `requirements.txt`, etc. These are skipped during tree building.
- **Build artifacts** — `build/`, `dist/`, `target/`, etc.

## Shell and Makefile support

For `.sh`/`.bash` files, DGAT extracts file mentions from `source` and `.` commands, plus `./` path references. For `Makefile`s, it extracts `include` directives. These aren't traditional imports but they represent file dependencies that should appear in the graph.

## The extraction pipeline

```
extract_imports(file_path, content)
  │
  ├─ extract_imports_via_tree_sitter()
  │   └─ if results found, return them
  │
  ├─ Language-specific fallback:
  │   ├─ bash/Makefile → extract_file_mentions()
  │   └─ other langs → extract_imports_fallback()
  │
  └─ normalize_import_path() for each import
      ├─ Apply tsconfig aliases
      ├─ Resolve Python relative imports
      ├─ Resolve ./ and ../ paths
      ├─ Try extensions, barrel files, __init__.py
      └─ Last resort: filename-only match
```

The result is a list of resolved `rel_path` values that become edges in the dependency graph.
