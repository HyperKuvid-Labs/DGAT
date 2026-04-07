(use_declaration
  (scoped_identifier (identifier) @import))

(use_declaration
  (use_tree (scoped_identifier (identifier) @import)))

(use_declaration
  (use_tree (scoped_identifier (identifier) @import)))

(use_declaration
  (use_tree (identifier) @import))

(extern_crate_declaration
  (string_literal)? @import
  (identifier) @import)

(use_declaration
  (module (string_literal) @import))