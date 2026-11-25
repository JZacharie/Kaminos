---
target: nfr-requirements
plugin: ui
adds:
  scopes:
    - ui-first
    - ui-workshop
  requires_stage:
    - ui-freeze
fragments:
  - anchor: before-step:3
    order: 100
  - anchor: before-step:6
    order: 100
---

## fragment: before-step:3

### Step 2a (ui): Sign-in is asked, never assumed

Role lookups are not sign-in. In the Security category, treat sign-in as undecided until a
person has answered "Does this need real sign-in?" in this record, in
`requirements-analysis-questions.md` or here. When no answer exists, add that question to
the questions file of Step 3 with these options: A. None, demo only. B. Shared secret.
C. Cognito or company SSO. X. Other (please specify). Never skip it because the app
already has users or roles.

## fragment: before-step:6

### Step 5a (ui): Enforce the access restriction or flag it

Before the completion handoff, compare the sign-in answer with every earlier answer about
who may use the app (for example "internal staff only"). In `security-requirements.md`,
either specify how the chosen sign-in enforces that restriction, with a requirement ID, or
write a section `## Not enforced` that names the restriction and says what is missing.

When a restriction is not enforced, the approval message of Step 7 states it in its own
line: "Not enforced: <restriction>. This version has <none | shared secret> sign-in." Do not
list a restriction as met when only a role lookup checks it.
