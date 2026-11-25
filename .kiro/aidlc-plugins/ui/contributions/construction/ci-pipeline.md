---
target: ci-pipeline
plugin: ui
adds:
  scopes:
    - ui-first
    - ui-workshop
  requires_stage:
    - ui-freeze
---

Put `ci-pipeline` under the `ui-first` and `ui-workshop` scopes.
