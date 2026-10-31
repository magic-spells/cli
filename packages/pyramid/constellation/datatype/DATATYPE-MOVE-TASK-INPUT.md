---
name: MoveTaskInput
status: built
connections:
  - DATATYPE-TASK-SUMMARY
---

Input for [[API-TOOL-MOVE-TASK]]. Targets a status (stage derived) and optionally a neighbor
for ordering. **Positions are server-generated** — the AI passes neighbor names, never a
fractional key ([[DOC-DESIGN-RULES]] rule 6).

```ts
interface MoveTaskInput {
  task: string;         // "WEB-42" or UUID
  status: string;       // target status name/key (carries its stage)
  after_task?: string;  // place after this task (key/UUID)
  before_task?: string; // or before this one
}
```
