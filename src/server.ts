import express, { Application, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { logger } from './middleware/logger';
// import { cacheMiddleware } from './middleware/cache';

// Route Imports
import authRouter from './auth/auth.route';
import router from './services/schools/schools.route';
import termsRouter from './services/academicTerms/terms.route';
import classRouter from './services/classes/classes.route';
import subjectRouter from './services/subjects/subjects.route';
import teacherSubjectRouter from './services/subjectTeachers/subjectTeacher.route';
import timetableRouter from './services/timetables/timetable.route';
import studentRouter from './services/students/student.route';
import financeRouter from './services/finance/finance.route';
import expensesRouter from './services/expenses/expense.route';
import examsRouter from './services/exams/exams.route';
import attendanceRouter from './services/attendance/attendance.route';
import homeworkRouter from './services/assignments/assignmeents.route';
import communicationRouter from './services/communications/communication.route';
import { apiLimiter, authLimiter } from './middleware/rate-limiter';
import userRouter from './services/users/users.route';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 8080;

// Trust proxy if behind a reverse proxy (e.g. Nginx, Heroku, Render)
app.set('trust proxy', 1);

// --- 1. WEBHOOKS (Must be raw) ---
// app.post("/api/payment/webhook", express.raw({ type: "application/json" }), webhookHandler);

// --- 2. SECURITY & PERFORMANCE MIDDLEWARE ---
app.use(helmet());
app.use(compression());
app.use(cookieParser()); // Required to parse HttpOnly cookies securely
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:4173",
    "https://schools.gakenye-ndiritu.co.ke"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(logger);

// --- 3. RATE LIMITING ---
app.use('/api/auth', authLimiter); // Stricter protection for login/signup
app.use('/api/', apiLimiter);      // General protection for all other endpoints

// // --- 4. CACHING LAYER ---
// // Apply response caching to GET requests globally (3 minutes default TTL)
// app.use(cacheMiddleware(180));

// --- 5. HEALTH CHECK ---
app.get('/', (_req: Request, res: Response) => {
  const usage = process.memoryUsage();
  res.status(200).json({
    success: true,
    message: "🏫 Junior School Management System API Operational",
    developer: "Gakenye Ndiritu",
    status: "Active",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    platform: process.platform,
    memoryUsage: {
      rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(usage.external / 1024 / 1024)} MB`
    },
    cpuUsage: process.cpuUsage()
  });
});

// --- 6. API ROUTE REGISTRATION ---
const apiRoutes = [
  { path: '/api/auth', router: authRouter },
  { path: '/api/schools', router: router },
  { path: '/api/terms', router: termsRouter },
  { path: '/api/classes', router: classRouter },
  { path: '/api/subjects', router: subjectRouter },
  { path: '/api/teacher-subjects', router: teacherSubjectRouter },
  { path: '/api/timetables', router: timetableRouter },
  { path: '/api/students', router: studentRouter },
  { path: '/api/finance', router: financeRouter },
  { path: '/api/expenses', router: expensesRouter },
  { path: '/api/exams', router: examsRouter },
  { path: '/api/attendance', router: attendanceRouter },
  { path: '/api/homework', router: homeworkRouter },
  { path: '/api/communication', router: communicationRouter },
  { path: '/api/users', router: userRouter },
  
];

apiRoutes.forEach(({ path, router }) => app.use(path, router));

// --- 7. UNKNOWN ROUTE HANDLER (404) ---
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "The requested API endpoint does not exist on this server.",
  });
});

// --- 8. GLOBAL ERROR HANDLING MIDDLEWARE ---
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "An internal server error occurred.",
  });
});

// --- 9. SERVER INITIALIZATION ---
const server = app.listen(PORT, () => {
  console.clear();
  console.log(`
  ==========================================================
  🏫 Junior School Management System Backend Initialized
  ----------------------------------------------------------
  Port:         ${PORT}
  Environment:  ${process.env.NODE_ENV || 'development'}
  Developer:    GAKENYE NDIRITU
  Status:       Ready, Cached, Rate-Limited & Secure ⚡
  ==========================================================
  `);
});

// Graceful Shutdown Handling
const gracefulShutdown = (signal: string) => {
  console.log(`\nReceived ${signal}. Closing HTTP server gracefully...`);
  server.close(() => {
    console.log("HTTP server closed. Process terminated.");
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));