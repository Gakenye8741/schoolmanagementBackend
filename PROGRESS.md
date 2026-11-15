# School Management System — Progress Log

_Last updated: Homework module complete_

---

## 🚦 Current state

| Layer | Status |
|---|---|
| Auth & users | ✅ Complete |
| Schools & tenancy | ✅ Complete |
| Academic terms | ✅ Complete |
| Academic structure (grade levels / subjects / classes) | ✅ Complete |
| Students | ✅ Complete |
| Attendance | ✅ Complete |
| Fees | ✅ Complete |
| **Grading Scales** | ✅ **Complete** |
| **Exams** (termExams + examSchedules + examResults) | ✅ **Complete** |
| **Timetables** (periods + timetables) | ✅ **Complete** |
| **Report Cards** (reportCards) | ✅ **Complete — just landed** |
| **Notifications** (notifications + smsLogs) | ✅ **Complete — just landed** |
| **Homework** (homeworkAssignments + homeworkSubmissions) | ✅ **Complete — just landed** |
| CBC assessments | ⏳ Blocked on curriculum strands |
| Schemes of work / lesson plans | ⏳ Ready to start |
| Communications (announcements / DMs / meetings) | ⏳ Ready to start |
| Events & co-curricular | ⏳ Ready to start |
| Library / inventory | ⏳ Ready to start |
| Transport | ⏳ Ready to start |
| Boarding | ⏳ Ready to start |
| Discipline | ⏳ Ready to start |
| Platform (imports / webhooks / audit) | ⏳ Ready to start |
| Everything else | ⏳ Not started |

**You can now demo the FULL academic cycle end-to-end:**
school admin sets up term → registers students → builds class timetable →
teacher marks attendance → bursar invoices fees → teacher enters exam marks →
**system auto-computes grades from a grading scale** → admin publishes results →
**admin generates report cards → parent gets notified by SMS → parent reads the card** →
teacher assigns homework → student submits → teacher grades → parent notified.

**You can also demo the timetable lifecycle:**
set the school day → allocate periods → build a class's week with double lessons →
assign teachers and rooms → run conflict checks → publish the master grid.

---

## ✅ Modules completed

### 1. Auth (`/api/auth`)

- `users`, `userSessions`, `verificationTokens`
- Super admin / school admin / staff registration
- Login (email / phone / admission / TSC), logout, logout-all, session listing
- Password reset / change
- Profile get / update
- Guardian ↔ student link (legacy path — superseded by students module)
- **Cleanup done:** students removed from `registerSchoolMemberService`; students now register via `/students` only

### 2. Schools (`/api/schools`)

- Basic CRUD
- Tenant boundary used across every module

### 3. Academic Terms & Windows (`/api/terms`)

- `academicTerms`, `termWindows` — 30 services
- Current term resolution via `isCurrentTerm = true` (backed by partial unique index)
- Overlap validation, promotion ladder validation
- Copy windows between terms
- Bulk create

### 4. Academic Structure (`/api/academic-structure`)

- `gradeLevels` — 20 services (promotion ladder + cycle detection)
- `subjects` — 18 services
- `classes` — 22 services
- **`linkStudentToClassService`** (#61) — atomic class assignment with enrollment-history write
- Grade string cleanup done (`classes.grade_level` dropped, unique index rebuilt on `grade_level_id`)

### 5. Students (`/api/students`)

**44 services covering:**

- `registerStudentService` — atomic `users` + `students` + optional enrollment history, **all in one transaction**
- CRUD, soft delete / restore, fuzzy search
- Lifecycle: enroll, withdraw, re-enroll, promote, graduate, repeat grade, transfer out, bulk promote
- Guardians: add, remove, set primary, update relationship, list per student, list per guardian
- Enrollment history: list, current, per-term, promotion candidates, graduation candidates
- Documents: add, list, delete, toggle parent visibility
- Health records: add, list
- Stats: count by school/class/gender, validate data completeness, full statistics
- `enrollStudentInClassService` wraps `linkStudentToClassService` — **no duplicated class logic**

### 6. Attendance (`/api/attendance`)

**30 services covering:**

**Marking**
- Mark one student / one day (upsert-safe)
- Bulk mark a whole class / one day (transactional)
- Update, delete
- Auto-mark missing students as absent
- Copy attendance from one date to another
- CSV import (row-by-row with admission-number lookup)

**Reads**
- Single record, student/date, student history (filterable)
- Class register for a day, class summary, school-wide summary
- Full monthly register grid per class

**Absentee tracking**
- Absentees for a date
- Late arrivals for a date
- Chronic absentees below threshold (default 80%)
- Students not yet marked

**Analytics**
- Attendance rate by class / by student
- Count by status (grouped)
- Daily trend over N days
- Gender breakdown
- School-wide stats
- Month-over-month comparison

**Helpers**
- Date validation (future, term bounds, term windows)
- Permission check (admin / class-teacher only)
- Audit trail (who marked what, when)

**Design choices:**
- `markedBy` **always** comes from `req.user.id` — never from the request body
- Service returns business-rule errors (`date outside term`, `not the class teacher`) that the controller surfaces verbatim
- Term boundary enforced at write time — no attendance in a school with no current term

### 7. Fees (`/api/fees`)

**60 services covering:**

**Setup**
- Fee items — CRUD, mandatory/optional split, bulk create, search
- Fee structures — **boarding-status-aware** (Day vs Boarding), **3-level override cascade** (school-wide → grade-level → class-specific), bulk upsert, copy from one term to another, validation against gaps

**Invoices**
- Generate for a single student, whole class, whole grade level, or the whole school — **auto-populates line items from the resolved fee structure**
- Invoice reads by student / term / status
- Update status, waive, cancel, apply discount, delete
- Mark overdue (cron candidate)

**Payments**
- Record payment — **FIFO auto-allocation to open invoices** if not tied to a specific invoice, transactional invoice-status update
- M-Pesa lookup by checkout ID
- Reverse payment (recomputes invoice status)
- Delete transaction (only pending/failed)

**Balance & statements**
- Per-student balance for a term — `billed / paid / balance` with `Cleared / Partial / Owed` status
- Full student statement across all terms
- Defaulters list (threshold-configurable)
- Cleared students list

**Analytics**
- Term financial summary
- Collections by method (Cash / Bank / M-Pesa / Cheque)
- Collections by boarding status
- Collections by grade level
- Aging report (0–30 / 31–60 / 61–90 / 90+ buckets)
- Daily collections, collection trend over N days
- Expected vs collected with collection-rate percentage
- One-shot dashboard (summary + breakdowns + aging + defaulters count)

**Design choices:**
- `recordedBy` **always** from `req.user.id` — never from the body
- **Auto-grade resolver** — the 3-level cascade in `resolveFeeForStudent` is the single source of truth for "how much does this student owe for this item?"
- Payment amount, invoice status, and balance recompute in **one transaction**
- `balanceRemaining` on `feeTransactions` is a **snapshot for receipts only** — never the source of truth
- The `openInvoicesIdx` partial index drives the arrears dashboard

### 8. Grading Scales (`/api/grading-scales`)

**18 services covering:**

**Scales**
- CRUD — name, description, default flag
- `setDefaultGradingScaleService` — transactional, clears others first, idempotent
- `getDefaultGradingScaleService` — returns scale **with all bands embedded**
- Copy scale (+ all bands) — for creating "KCSE 2027" from "KCSE 2026"
- **`seedDefaultGradingScaleService`** — creates a ready-to-use scale from a template:
  - KCSE (12 bands: A → E)
  - CBC (4 bands: EE / ME / AE / BE)
  - Percentage A–E (5 bands)
  - IGCSE 1–9 (9 bands)

**Bands**
- CRUD — minScore / maxScore / grade / points / descriptor / remark
- Bulk create — full ladder in one call
- Delete all bands for a scale
- **Overlap rejection at write time** — a band that overlaps an existing one is refused with a 400
- **Coverage gap warnings** — the validate endpoint reports holes but doesn't block save

**Resolution**
- **`resolveGradeForMarkService`** — the core helper used by exams: mark (0–100) → grade from the scale's bands

**Validation**
- `validateGradingScaleService` — overlap check + coverage check + coverage range report

**Design choices:**
- `oneDefaultIdx` partial unique index guarantees exactly one default per school, backed by a transactional service
- Templates are seeded **without auto-defaulting** — admin picks the default explicitly after seeing all options
- Band overlap enforced by the service **and** by a DB check constraint (`grading_band_range_chk`: `maxScore >= minScore`)

### 9. Exams (`/api/exams`)

**35 services covering:**

**Exams (`termExams`)**
- Create / get / list by term / list by school / list by category
- Update, lock, unlock, delete (locked exams cannot be edited or deleted)
- Statistics — mean, distribution, completion rate, unique students/subjects

**Schedules (`examSchedules`)**
- Create single, bulk create whole exam timetable
- List by exam / class / date
- Update, delete
- Upsert on bulk — same `(exam, class, subject)` replaces rather than errors

**Mark entry (`examResults`)**
- **`enterMarkService`** — single mark, **auto-computes grade and points from the grading scale** before saving
- **`bulkEnterMarksService`** — whole class × subject in one transactional call, same auto-grade
- Update mark, delete mark, mark absent
- **Absent ≠ zero** — `isAbsent: true` sets `marks: null, grade: null`, excluded from rankings and means

**Marksheet & publishing**
- **`getMarksheetService`** — teacher's view: full class roster with current marks, grades, absence flags
- **`publishMarksService`** — computes subject positions + class rankings + **locks the exam** in one call

**Computation**
- **`computeGradesForExamService`** — batched fix-up: re-derives grades from the current scale (useful after scale changes). Uses bulk `UPDATE WHERE id IN (...)` instead of per-row updates
- **`computeSubjectPositionsService`** — rank within class per subject, handles ties (same mark = same position)
- **`computeClassRankingService`** — overall mean + position per student across all subjects
- **`computeSubjectStatisticsService`** — per-subject mean, mean %, pass rate, distribution
- **`computeClassPerformanceService`** — per-class aggregate

**Reports & transcripts**
- **`getStudentTranscriptService`** — full academic history: every exam, every term, every subject, batched fetches
- **`getExamReportService`** — one-shot: summary + by-subject + by-class statistics

**Design choices:**
- `enteredBy` **always** from `req.user.id` — never from the body
- **Auto-grade on entry** — parents see grades immediately, not just marks
- **Locked exams reject all mutations** — publish flow enforces finality
- **Absent students excluded from rankings** — `isAbsent: true` is not scored zero
- **Tie handling** — two students with the same mark get the same subject position
- **Batched computations** — no `await` inside loops; each grade bucket updated in one query
- Falls back to **school default grading scale** if exam has no explicit `gradingScaleId`

### 10. Timetables (`/api/timetables`)

**67 services covering:**

**Periods (`periods`) — 14 services**
- CRUD — create, bulk create, get by id, get by number, list all, list teaching (`isBreak = false`), list breaks
- Update, delete (blocked if any slot uses the period)
- Reorder — bulk renumber by `orderedIds`
- Validation — overlap detection + period-number gaps
- First / last period of the day
- Active period lookup by current time (dashboards / bell)
- Count periods per school

**Timetable slots (`timetables`) — 53 services**

*Create / modify*
- Create single, bulk create for a class, bulk create for the whole school
- Get slot by id, update slot, delete slot
- Move slot (day + period), swap two slots atomically
- Assign teacher (with conflict guard), assign room (with conflict guard)
- Copy timetable from one class to another
- Clone timetable within a school (validates both classes belong to the school)
- Bulk delete by ids, bulk update by ids

*Reads & views*
- Class weekly grid (periods × days, breaks shown)
- Class timetable for one day
- Class timetable for today
- Current / next lesson for a class
- Teacher full timetable, teacher timetable for one day
- Teacher weekly view (grouped by day)
- Current lesson for a teacher
- Upcoming lessons for a teacher (next N minutes)
- Slot by class + day + period
- List all slots for a school
- Slots by subject / by teacher / by room
- All unassigned-teacher slots, all no-room slots
- All free slots for a class
- All classes with no timetable
- School-wide grid (all classes × all days)
- Flat export (for CSV / PDF printing)

*Analytics*
- Timetable coverage stats (expected vs actual, percentage)
- Subject allocation (hours per subject per week)
- Class workload (lessons per subject per week)
- Class slots per day
- Teacher workload (lessons per week)
- Teacher availability matrix (busy / free grid)
- Least-loaded teacher for a subject (allocation helper)

*Conflicts & validation*
- Check teacher conflict at day / period
- Check class conflict at day / period
- Check room conflict at day / period
- Validate whole school timetable (all teacher + room double-bookings in one call)

*Deletes*
- Delete one slot
- Delete one slot by class + day + period
- Clear a class's timetable
- Clear one day across the school
- Clear the whole school timetable
- Delete a period (blocked if in use)

**HTTP test flow (`### HOW A KENYAN SCHOOL BUILDS A TIMETABLE`)** — 62 requests in 10 steps, tested end-to-end:
1. Set the school day (13 periods, 3 breaks)
2. Adjust the day / reorder periods
3. Build one class's week (45 slots Mon–Fri with double lessons for Maths/Sciences)
4. Parallel streams (bulk school create + clone)
5. Class views (grid, today, current, next, free slots, workload)
6. Teacher views + assign teachers/rooms
7. Conflict checks (validate / teacher / class / room)
8. Master timetable (grid, export, subject/teacher/room lookups, active period)
9. Changes during the term (move, swap, edit)
10. Cleanup (delete one, delete many, clear class/day/school, delete period)

**Design choices:**
- **Unique index** on `(classId, dayOfWeek, periodId)` — one lesson per class per slot, DB-enforced
- **Teacher conflict check** at write time + dedicated check endpoint — a teacher cannot be double-booked
- **Room conflict check** at write time + dedicated check endpoint — a room cannot be double-booked
- **Period overlap validation** — periods must be non-overlapping and contiguous (gap warnings don't block)
- **Auto-day resolution** — "today" / "current lesson" derive `Weekday` from `new Date()` (Sunday → Monday mapping fixed)
- **Batched fetches** — no `await` inside loops; timetable grids build slot lookups once per request
- **Atomic swap** — uses a temp sentinel period inside a transaction to dodge the unique-index collision during the two-way swap
- **School scoping everywhere** — every write re-asserts class / period / subject / teacher all belong to the same `schoolId`
- **`updatedAt`** touched on every mutation (reorder, move, assign, swap)
- **`periodId` FK uses `RESTRICT`** — a period used by a slot cannot be deleted; `teacherId` uses `SET NULL` so a deleted teacher does not orphan slots

**FK chain**