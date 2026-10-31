---
name: Phase 3 — Collaboration & admin
status: planned
connections:
  - PLAN-PROJECT
---

# Phase 3 — Collaboration & admin

Lower-frequency surface, built once the core loop is proven. Grouped in
[[DOC-TOOLS-COLLAB]] / [[FILE-TOOLS-COLLAB]].

- Followers: `follow_task` / `unfollow_task` / `list_followers`.
- Labels: `add_label` / `remove_label` / `list_labels` / `create_label` (admin/pm).
- Estimates: `set_estimates` (per-status phase estimates; returns total + by-stage).
- Custom fields: `set_custom_field` (type-checked against the field's `field_type`).
- Notifications: `list_my_notifications`, `mark_read` / `mark_all_read`.
- Workflow admin (admin/pm): `list_stages`, `list_statuses`, `list_members`.
- Prompts: `pyramid:standup`, `pyramid:plan-sprint`, `pyramid:triage` ([[FILE-PROMPTS]]).
