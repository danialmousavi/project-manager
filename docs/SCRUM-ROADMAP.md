# Scrum roadmap

## Task 1 — Task model

- Backend: complete
- Frontend: complete

Implemented: task type (`STORY`, `TASK`, `BUG`), optional story points,
project-scoped backlog rank, optional acceptance criteria, API validation,
authorization through the existing task access policy, migration, tests, and
the Persian/RTL task form and task-detail display.

## Task 2 — Sprint completion

- Backend: complete
- Frontend: complete

Implemented: future-sprint creation with a goal and a date range, editing of
future sprints, a dedicated start operation, one active sprint per project,
and an immutable snapshot of every planned task and its Story Points when the
sprint starts. Existing sprints are preserved: their `PLANNED` status is
migrated to `FUTURE`. The Persian/RTL UI supports creating and editing future
sprints, displaying the goal and date range, starting a sprint, and viewing
the saved planning snapshot.

## Task 3 — Product Backlog

- Backend: complete
- Frontend: complete

Implemented: project backlog API with active-sprint, future-sprint, and
unplanned-backlog sections; assignee, type, and priority filters; Story Point
totals; task transfer or return to backlog; and persisted task movement and
rank history.
The Persian/RTL backlog page supports filtering, quick task creation, moving
tasks between the visible backlog sections with drag and drop, and rank edits.

## Tasks 4–7

- Backend: not started
- Frontend: not started
