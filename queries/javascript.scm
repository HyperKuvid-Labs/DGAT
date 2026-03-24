(import_clause
  (string_literal) @import)

(import_clause
  (namespace_import (identifier) @import))

(import_clause
  (named_imports (import_specifier (identifier) @import)))

(import_statement
  (string_literal) @import)

(import
  (string_literal) @import)

( call_expression
    (identifier)
    (arguments (string_literal) @import))

((string_literal) @import
  (#match? @import "^\\.?\\.?/.*"))

((string_literal) @import
  (#match? @import "^[@].*"))