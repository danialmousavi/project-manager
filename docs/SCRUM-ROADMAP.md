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
tasks between the visible backlog sections with drag and drop, rank edits, and
compact browsing for large lists. Task movement is recorded in history across
the backlog and sprint-management routes.

## Task 4 — Active Sprint Board

- Backend: complete
- Frontend: complete

Implemented: the Kanban API now scopes its tasks to the active sprint and
returns the sprint name, goal, dates, remaining days, completed-task count,
and planned Story Point total. The existing Kanban UI shows this sprint context,
an empty state when no sprint is active, drag-and-drop status changes, and quick
task creation inside each column.

## Task 5 — Sprint end

- Backend: complete
- Frontend: complete

Implemented: an active sprint can be ended atomically. The system saves an
immutable end-of-sprint report containing planned, completed, and unfinished
task and Story Point totals; retains completed work in the completed sprint;
and moves unfinished work either back to the product backlog or to a selected
future sprint without changing its status. Task movement is recorded in task
history, and the saved report remains unchanged if a task is edited later.
The sprint-management UI provides an end-sprint modal with a live work
summary, a choice between returning unfinished work to the backlog or moving
it to a future sprint, and a persistent final-report panel on completed
sprints.

## Task 6 — Epics and subtasks

- Backend: complete
- Frontend: complete

Implemented: an Epic belongs to exactly one project and groups existing work
items without introducing a new task type. A task can reference one Epic and
can have one direct parent task; only one subtask level is allowed. APIs
validate project ownership, reject cross-project links and nested/cyclic task
relationships, list an Epic with its visible tasks, expose task detail with
subtasks, and filter the product backlog by Epic.
The task form supports assigning an Epic and choosing a direct parent task;
task lists and expanded task details display Epic, parent, and direct-subtask
context. The backlog adds Epic creation, task-count context, and an Epic
filter while retaining its existing compact workflow.

## Task 7

- Backend: not started
- Frontend: not started
