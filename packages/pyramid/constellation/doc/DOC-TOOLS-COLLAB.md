---
name: Collaboration & admin tools
kind: guide
status: planned
connections:
  - PLAN-PHASE-3-COLLAB-ADMIN
  - FILE-TOOLS-COLLAB
---

# Collaboration & admin tools (phase 3)

Lower-frequency future surface, to be added as operations in [[FILE-OPERATIONS]] after the core loop
ships ([[PLAN-PHASE-3-COLLAB-ADMIN]]).

- **Followers:** `follow_task` / `unfollow_task` / `list_followers`.
- **Labels:** `add_label` / `remove_label` / `list_labels` / `create_label` (admin/pm).
- **Estimates:** `set_estimates(task, estimates)` — per-status; returns total + by-stage.
- **Custom fields:** `set_custom_field(task, field, value)` — typed per `field_type` -> `invalid_field_value` on mismatch.
- **Notifications:** `list_my_notifications(unread_only?)`, `mark_read` / `mark_all_read`.
- **Workflow admin (admin/pm):** `list_stages`, `list_statuses`, `list_members`.
`delete_task` shipped with the core task operations as [[API-TOOL-DELETE-TASK]] because it is the
destructive counterpart to archive/unarchive.
