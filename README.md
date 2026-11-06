# 🏫 Junior School Management System — Backend

This is the backend service for a multi-tenant Junior School Management System built with **TypeScript**, **Express**, **Drizzle ORM**, **PostgreSQL**, **JWT (cookie-based)**, and **Node.js**. It powers user authentication, school administration, admissions, attendance, fees, and exams for one or more schools on a single deployment.

---

## 📦 Features

- 🔐 **Cookie-based JWT authentication** — httponly session cookie, revocable server-side sessions
- 🧾 **Bcrypt-hashed passwords** — never stores or transmits plain passwords
- 🧑‍💼 **Multi-role access** — `super_admin`, `school_admin`, `principal`, `deputy_principal`, `bursar`, `registrar`, `librarian`, `teacher`, `parent`, `student`
- 🏢 **Multi-tenant architecture** — every school is fully isolated; all reads/writes are scoped by `schoolId`
- 🧑‍🎓 **Admissions** — atomic registration of `users` + `students` in one transaction
- 👨‍👩‍👧 **Guardian linking** — parent accounts linked to students with primary/payer/pickup flags
- 📅 **Academic terms** — current-term resolution, overlapping-date validation, promotion ladders
- 🏫 **Academic structure** — grade levels with promotion chains, subjects, classes, class-subject assignments
- ✅ **Attendance** — daily marking, bulk class entry, absentee tracking, chronic-absentee analytics, monthly registers
- 💰 **Fees** — fee items, grade/boarding-aware fee structures, invoices, payments (cash/bank/M-Pesa/cheque), FIFO auto-allocation, arrears dashboards
- 🎓 **Grading scales** — KCSE, CBC, IGCSE, percentage templates + custom scales with overlap rejection
- 📝 **Exams** — term exams, schedules, mark entry with **auto-grade computation**, publishing, ranking, transcripts
- 🧠 **Type-safe database layer** — Drizzle ORM throughout
- 🗂️ **Modular Express API** — one folder per domain, consistent patterns
- ⚙️ **Environment-based configuration** — `.env`-driven

---

## 🧠 What happens behind the scenes

### Authentication

- Users register with credentials. Passwords are hashed with Bcrypt.
- On login, a JWT is issued and stored as an `httpOnly` cookie.
- A matching `userSessions` row (hashed token) is written so sessions can be revoked.
- `super_admin` has no `schoolId` and operates at the platform level.
- All other roles are scoped to a single school.

### School setup

- A super admin creates schools and school admins.
- A school admin sets up grade levels (with promotion chains), subjects, and classes.
- Academic terms are created per school — **exactly one is marked `isCurrentTerm = true`** (partial unique index enforces this).

### Admissions

- `POST /students` creates **both** `users` (login) and `students` (academic identity) in a single transaction.
- If a class is provided at admission time, an enrollment-history row is also written for the current term.
- Parents are registered separately via `POST /auth/register/member` with `role: "parent"`, then linked via `POST /students/:id/guardians`.
- `users.id` = auth identity. `students.id` = academic identity. Never interchange them.

### Attendance

- Teachers mark attendance daily per class.
- Bulk entry is transactional — the whole class in one call.
- Absence is not the same as zero; chronic-absentee queries use a partial index on `(schoolId, date) WHERE status IN ('Absent', 'Late')`.
- Attempts to mark outside the current term or by the wrong teacher are rejected by the service.

### Fees

- Fee items are defined once per school (Tuition, Lunch, Boarding, Exam Fee, etc.).
- Fee structures use a **three-level cascade**:
  1. Class-specific override
  2. Grade-level default
  3. School-wide base
- Each fee row also carries a **boarding status** (`Day` / `Boarding`) — so day and boarding students have different amounts for the same item.
- Invoices generate line items automatically from the resolved structure for each student.
- Payments auto-allocate **FIFO** to open invoices if not tied to a specific one — matching how bursars actually work.

### Exams

- A term exam is created with a linked grading scale (or falls back to the school's default).
- Teachers enter marks per student per subject. The service **auto-computes `grade` and `points`** from the grading scale bands — the client never sends them.
- Publishing an exam computes subject positions + class rankings and then **locks the exam** — further edits are rejected until unlocked.
- Absent students (`isAbsent = true`) are excluded from rankings and means; they are not scored as zero.

### Security

- Cookie-based JWT on every protected route.
- `bearAuth` middleware validates the cookie and populates `req.user` (`id`, `role`, `roles`, `schoolId`).
- Route-level guards (`adminAuth`, `adminOrTeacherAuth`, `superAdminAuth`, `anyAuthenticatedUser`) enforce role access.
- Cross-tenant writes are rejected by services — every mutation verifies the entity belongs to `req.user.schoolId`.

---

## 🛠️ Tech Stack

| Layer       | Tech                              |
|-------------|-----------------------------------|
| Language    | TypeScript                        |
| Runtime     | Node.js                           |
| Server      | Express.js                        |
| ORM         | Drizzle ORM                       |
| Database    | PostgreSQL                        |
| Auth        | JWT (cookie-based) + bcrypt       |
| Validation  | Zod                               |
| Config      | dotenv                            |

---

## 📁 Project structure
