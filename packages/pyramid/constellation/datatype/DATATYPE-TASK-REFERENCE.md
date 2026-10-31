---
name: TaskReference
status: built
connections:
  - DATATYPE-TASK-DETAIL
  - EXTERNAL-PYRAMID-API
  - DOC-RENDERING
  - API-TOOL-LIST-REFERENCES
---

An external reference linked to a task — git PRs / commits / branches and Figma links — from
`GET /v1/tasks/{id}/references`. Used to render the git drill-in ([[DOC-RENDERING]]).

```ts
interface TaskReference {
  id: string;
  reference_type: "github_pr" | "github_commit" | "github_branch" | "github_issue" | "figma" | "url";
  title: string;
  url: string;
  external_status: string | null;  // PR: "open" | "closed" | "merged"
  external_sub_id: string | null;  // PR number / commit sha
}
```

**Read-only + webhook-sourced.** GitHub links are created by the GitHub App webhook parsing the
task key (e.g. `MOGO-123`) from commit messages / PR title+body / branch names — Pyramid only knows
what was linked. Metadata is partial (no diff/CI/review state), `external_status` for PRs is only
open/closed/merged, and there is **no on-demand refresh** (reflects the last webhook) and **no
project-wide reference query**. The advertised `/tasks/{id}/github` endpoint is NOT wired — use
`/references`.
