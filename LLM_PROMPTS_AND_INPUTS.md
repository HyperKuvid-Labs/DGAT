# DGAT: LLM Prompts & Inputs - Complete Breakdown

This document shows exactly what data is sent to the LLM for each type of description.

---

## Overview

DGAT makes 4 types of LLM calls:

1. **File Descriptions** — "What does this file do?"
2. **Dependency Descriptions** — "What is this external library?"
3. **Edge Descriptions** — "Why does file A import from file B?"
4. **Project Blueprint** — "Summarize the entire project architecture"

Each call is templated using **Inja** (C++ template engine) to inject the actual data.

---

## 1. FILE DESCRIPTIONS

### Purpose
Generate a natural-language description of what a single source file does.

### When It Happens
- During `dgat scan` — for every source file
- During `dgat update` — only for files that changed (by XXH3 hash)

### Input Data

| Field | Source | Example |
|-------|--------|---------|
| `file_name` | File's rel_path | `src/utils/helpers.ts` |
| `file_content` | Read from disk | Raw source code (truncated to 20K chars) |
| `folder_structure` | Extracted from tree | Tree representation of directory structure |
| `software_bluprint_details_pretty` | README.md | Parsed project context |

### The Prompt Template

```jinja2
You are a senior software engineer doing a quick code review pass. Analyze the file below and write a short markdown description of what it does.

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
  - No intro text, no closing remarks, just the markdown
```

### Rendered Example

For `src/components/Button.tsx`:

```
You are a senior software engineer doing a quick code review pass. Analyze the file below and write a short markdown description of what it does.

Project context:
{
  "name": "MyApp",
  "description": "A React-based UI component library",
  ...
}

Repo structure:
MyApp/
├── src/
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   └── Input.tsx
│   ├── utils/
│   │   └── helpers.ts
│   └── App.tsx
└── package.json

File: `src/components/Button.tsx`

Content:
import React from 'react';
import { applyTheme } from '../utils/helpers';

export const Button: React.FC<ButtonProps> = ({ 
  label, 
  variant = 'primary', 
  onClick, 
  disabled 
}) => {
  const styles = applyTheme(variant);
  return (
    <button 
      className={styles.button}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
};

Return a JSON object with a single key `file_description` whose value is a compact markdown string...
```

### Expected Output

```json
{
  "file_description": "**Reusable button component** — renders a clickable button with configurable variant and disabled states. Applies theme-based styling using the shared helpers utility."
}
```

### Context Provided

- ✅ File content (full source code)
- ✅ Project README (if exists)
- ✅ Directory structure (shows what other files exist nearby)
- ✅ File name itself (often hints at purpose)

### Why These Inputs?

The LLM needs:
1. **File content** — understand what the code does
2. **Directory context** — understand what role this file plays (is it a util? a component? a handler?)
3. **Project context** — understand what the overall system does
4. **Filename** — sometimes the name is the best hint (`logger.ts`, `config.json`, `index.html`)

---

## 2. DEPENDENCY DESCRIPTIONS

### Purpose
Generate a description for external dependencies that are imported but not defined in the project (npm packages, system libraries, etc.).

### When It Happens
After the dependency graph is built, for nodes marked as `"External dependency"` or `"Gitignored dependency"`

### Input Data

| Field | Source | Example |
|-------|--------|---------|
| `dep_name` | Package/module name | `react`, `lodash`, `numpy`, `os` |
| `importers` | Files that import it | `src/App.tsx, src/components/Button.tsx, src/pages/Dashboard.tsx` (up to 5) |

### The Prompt Template

```jinja2
Provide a brief description (1-2 sentences) of the external dependency "{{ dep_name }}" used in software development.

  {% if importers %}
  This dependency is imported by: {{ importers }}
  {% endif %}

  Return ONLY a simple description, no markdown formatting.
```

### Rendered Example 1: npm Package

```
Provide a brief description (1-2 sentences) of the external dependency "react" used in software development.

This dependency is imported by: src/App.tsx, src/components/Button.tsx, src/pages/Dashboard.tsx, src/components/Modal.tsx

Return ONLY a simple description, no markdown formatting.
```

**Expected Output:**
```
React is a JavaScript library for building user interfaces with reusable components and reactive state management.
```

### Rendered Example 2: Python Standard Library

```
Provide a brief description (1-2 sentences) of the external dependency "numpy" used in software development.

This dependency is imported by: data_processing.py, model_training.py

Return ONLY a simple description, no markdown formatting.
```

**Expected Output:**
```
NumPy is a Python library for numerical computing with support for arrays, matrices, and mathematical operations.
```

### Context Provided

- ✅ Package name
- ✅ List of files that import it (up to 5, plus count of remaining)

### Why These Inputs?

The LLM knows what popular packages do, so it needs minimal context:
1. **Package name** — the LLM already knows what `react`, `lodash`, `pandas` are
2. **Who imports it** — gives context about the project's domain (data science vs web frontend)

---

## 3. EDGE DESCRIPTIONS

### Purpose
Generate a one-sentence explanation of why file A imports from file B.

### When It Happens
After all file descriptions are generated, for each dependency edge where both files have real (non-placeholder) descriptions

### Filters Applied

Edges are **skipped** if:
- Either endpoint has a placeholder description like:
  - `"External dependency"`
  - `"Gitignored dependency"`
  - `"Source file"`
  - Empty string

**Reason:** If the LLM doesn't understand what one of the files does, it can't explain the relationship.

### Input Data

| Field | Source | Example |
|-------|--------|---------|
| `from_path` | Importing file's rel_path | `src/pages/Dashboard.tsx` |
| `from_desc` | That file's description | `"**Dashboard page** — main user interface showing analytics..."` |
| `to_path` | Imported file's rel_path | `src/utils/formatters.ts` |
| `to_desc` | That file's description | `"**Utility formatters** — provides date, number, and currency formatting..."` |
| `import_stmt` | The actual import statement | `import { formatDate, formatCurrency } from '../utils/formatters'` |

### The Prompt Template

```jinja2
given these two files in the same project:

file A: `{{ from_path }}`
description: {{ from_desc }}

file B: `{{ to_path }}`
description: {{ to_desc }}

import statement: `{{ import_stmt }}`

in one tight sentence, describe what file A uses from file B and why.
return only the sentence, no preamble.
```

### Rendered Example

```
given these two files in the same project:

file A: `src/pages/Dashboard.tsx`
description: **Dashboard page** — displays analytics and metrics. Shows real-time data with charts and tables. Handles user interactions and filtering.

file B: `src/utils/formatters.ts`
description: **Utility formatters** — provides date, number, and currency formatting functions. Handles localization and custom number patterns.

import statement: `import { formatDate, formatCurrency } from '../utils/formatters'`

in one tight sentence, describe what file A uses from file B and why.
return only the sentence, no preamble.
```

**Expected Output:**
```
Dashboard.tsx uses the formatDate and formatCurrency utilities from formatters.ts to display analytics data in localized human-readable formats.
```

### Context Provided

- ✅ Source file name and description
- ✅ Target file name and description
- ✅ The actual import statement from the code

### Why These Inputs?

To explain "why A imports from B", the LLM needs:
1. **What A does** — understand the context of the importer
2. **What B does** — understand what's being imported
3. **Exactly what's imported** — the import statement shows which specific functions/classes are used
4. **The relationship** — combine all above to explain "why"

### Example Chain

```
from_file: page.tsx displays charts
to_file: utils.ts has formatting functions
import_stmt: import { formatDate } from './utils'

LLM reasoning: "page displays charts AND utils has formatting AND formatDate is imported → 
page uses formatDate from utils to format chart data"
```

---

## 4. PROJECT BLUEPRINT

### Purpose
Generate a high-level architectural summary of the entire project (5-10 paragraphs).

### When It Happens
At the end of `dgat scan`, after all file descriptions are complete

### Input Data

| Field | Source | Example |
|-------|--------|---------|
| `folder_structure` | Extracted from tree | Directory tree (text representation) |
| `file_descriptors_pretty` | Collected from all files | Array of {filename, description} pairs |

### The Prompt Template

```jinja2
You are a professional software architect. Read the file descriptions and write a clear software blueprint for this project.

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
  (important implementation details, limits, and notes)
```

### Rendered Example

For a React UI project, the blueprint input would be:

```
You are a professional software architect. Read the file descriptions and write a clear software blueprint for this project.

  ### Folder Structure
  Project directory structure:
  MyApp/
  ├── src/
  │   ├── pages/
  │   │   ├── Dashboard.tsx
  │   │   ├── Settings.tsx
  │   │   └── Profile.tsx
  │   ├── components/
  │   │   ├── Button.tsx
  │   │   ├── Modal.tsx
  │   │   ├── Header.tsx
  │   │   └── Sidebar.tsx
  │   ├── utils/
  │   │   ├── formatters.ts
  │   │   ├── validators.ts
  │   │   └── api.ts
  │   └── App.tsx
  ├── package.json
  └── tsconfig.json

  ### File Descriptors
  File descriptions (purpose and behavior of each file):
  [
    {
      "file_name": "src/App.tsx",
      "description": "**Main app component** — root React component. Sets up routing and global state context. Renders the header and main content area."
    },
    {
      "file_name": "src/pages/Dashboard.tsx",
      "description": "**Dashboard page** — displays analytics and metrics. Shows real-time data with charts and tables. Handles user interactions and filtering."
    },
    {
      "file_name": "src/components/Button.tsx",
      "description": "**Reusable button component** — renders clickable button with configurable variant and disabled states. Applies theme-based styling."
    },
    {
      "file_name": "src/utils/formatters.ts",
      "description": "**Utility formatters** — provides date, number, and currency formatting functions. Handles localization and custom patterns."
    },
    ... (up to 50 files)
  ]

  Use simple and professional language. Keep only relevant information.

  Return ONLY markdown content (no JSON and no outer code fence) using this exact structure:

  # DGAT Software Blueprint

  ## Project Overview
  ...
```

### Expected Output

```markdown
# DGAT Software Blueprint

## Project Overview
MyApp is a React-based web application for analytics and user management. It provides a dashboard for viewing metrics, pages for user settings and profile management, and a component library for consistent UI patterns.

## Architecture
The application follows a component-based architecture with three main layers:
- **Pages** (Dashboard.tsx, Settings.tsx, Profile.tsx) — top-level route components that compose the UI for each page
- **Components** (Button.tsx, Modal.tsx, Header.tsx, Sidebar.tsx) — reusable UI building blocks with configurable props
- **Utils** (formatters.ts, validators.ts, api.ts) — shared business logic for formatting, validation, and API communication

The App.tsx component serves as the entry point, setting up routing and global context.

## Technical Details
- Built with React and TypeScript for type safety
- Uses component-based architecture for reusability
- Supports theme-based styling with the Button component
- Includes utilities for date/number formatting and data validation
- API communication handled through a centralized api.ts module
```

### Context Provided

- ✅ Directory structure (shows organization)
- ✅ All file descriptions (up to 50; larger projects show truncated list + count)

### Why These Inputs?

To synthesize a project blueprint, the LLM needs:
1. **Folder organization** — understand how the project is structured
2. **File purposes** — understand what each file does
3. **Descriptions in order** — read them to understand the flow and relationships

### Limitations

- **Max 50 files shown** — to prevent token overflow
- **Large projects show truncation** — e.g., "[... and 150 more files ...]"
- **Depends on file descriptions** — if file descriptions are poor, blueprint is poor

---

## Summary: The LLM Call Chain

```
1. FILE DESCRIPTIONS (8 parallel workers)
   Input: file_content + folder_structure + project_context
   Output: "**X does Y** — provides Z"
   
   ↓ (all complete)
   
2. DEPENDENCY DESCRIPTIONS (8 parallel workers)  
   Input: dep_name + importers_list
   Output: "Package X is a library for Y"
   
   ↓ (all complete)
   
3. EDGE DESCRIPTIONS (8 parallel workers, filtered)
   Input: from_desc + to_desc + import_stmt
   Output: "A uses B from C to do D"
   
   ↓ (all complete)
   
4. PROJECT BLUEPRINT (single LLM call)
   Input: folder_structure + all_file_descriptions
   Output: Markdown document with overview, architecture, technical details
```

---

## Context Token Management

DGAT is careful about token usage:

### For File Descriptions
- **Available tokens**: ~20,000 (after prompt + context overhead)
- **File content truncated** to fit in available budget
- **Ratio**: Larger files get less of their content shown
- **Code**: `if (available_tokens > 20000) available_tokens = 20000;` (caps at 20K)

### For Blueprint
- **Max file descriptors**: 50 (prevents context overflow)
- **Truncation marker**: Shows "[... and N more files ...]" if project has >50 files
- **Output format**: Expects markdown (can be long, no token limit on response)

---

## LLM Provider Agnostic

All prompts are sent via:
```cpp
json request_payload = {
  {"model", g_llm_config.model},
  {"messages", {{
    {"role", "user"},
    {"content", rendered_prompt}
  }}}
};
```

Works with any **OpenAI-compatible API**:
- vLLM
- Ollama
- OpenAI
- Anthropic
- OpenRouter
- etc.

The prompt template (Inja) is provider-agnostic — no special formatting for specific LLMs.

---

## Real-World Example

### Input Project Structure
```
myapp/
├── main.py
├── config.py
├── utils/
│   ├── logger.py
│   └── validators.py
├── models/
│   ├── user.py
│   └── database.py
└── tests/
    └── test_user.py
```

### Step 1: File Descriptions
```
LLM CALL #1: "What does main.py do?"
Input: main.py content + folder structure + README
Output: "**Entry point** — loads config, initializes database, starts Flask server on port 5000"

LLM CALL #2: "What does models/user.py do?"
Input: user.py content + folder structure + README
Output: "**User model** — defines User ORM class with validation. Maps to database users table."

... (6 more for each file)
```

### Step 2: Dependency Descriptions
```
LLM CALL #9: "What is sqlalchemy?"
Input: dep_name="sqlalchemy" + importers_list=["models/user.py", "models/database.py"]
Output: "SQLAlchemy is a Python ORM library for object-relational mapping and database operations."
```

### Step 3: Edge Descriptions
```
LLM CALL #10: "Why does main.py import from models/user.py?"
Input: 
  from_desc: "**Entry point** — loads config, initializes database, starts Flask server"
  to_desc: "**User model** — defines User ORM class with validation"
  import_stmt: "from models.user import User"
Output: "main.py imports the User model from models/user.py to register it with the database ORM on startup."
```

### Step 4: Blueprint
```
LLM CALL #11: "Write the project blueprint"
Input: folder_structure + all 8 file descriptions
Output: 
  "# Software Blueprint
   
   ## Overview
   myapp is a Flask-based REST API for user management...
   
   ## Architecture
   - main.py: Entry point and Flask app initialization
   - config.py: Configuration management
   - models/: ORM models (User, Database connection)
   - utils/: Shared utilities (logging, validation)
   - tests/: Unit tests
   
   ## Technical Details
   Uses SQLAlchemy for database access..."
```

---

## Conclusion

DGAT generates descriptions at **4 levels**:

1. **Files** — "What does this one file do?" (needs: content + context)
2. **Dependencies** — "What is this package?" (needs: name + who uses it)
3. **Edges** — "Why does A use B?" (needs: both descriptions + import statement)
4. **Project** — "What is the whole system?" (needs: all file descriptions + structure)

Each level builds on the previous one, and the LLM only gets the data it needs to answer the question at hand.
