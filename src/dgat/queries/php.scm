(use_declaration
  (namespace_aliasing_use
    (qualified_name) @import
    (identifier) @import))

(use_declaration
  (namespace_use_clause
    (qualified_name) @import))

(use_declaration
  (namespace_use_clause
    (group_use
      (namespace_import (qualified_name) @import))))

(php_static_method_invocation
  (class_name (name) @import))

(php_class_static_attribute
  (class_name (name) @import))