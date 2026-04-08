import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initSmsCronJob } from "./jobs/smsReminderJob.js";
import { aj } from "./lib/arcjet.js";
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import facultyRoutes from "./routes/facultyRoutes.js";
import hodRoutes from "./routes/hodRoutes.js";
import hrRoutes from "./routes/hrRoutes.js";
import operatorRoutes from "./routes/operatorRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import smsRoutes from "./routes/smsRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize dotenv to use environment variables from .env file in parent directory
dotenv.config({ path: join(__dirname, '..', '.env') });
//CONSTANTS
// Load environment variables from .env file
const PORT = process.env.PORT || 3000;
// Initialize Express app
const app = express();
// What it is helmet:
// Helmet helps secure Express apps by setting various HTTP headers.
// What it does:
// Sets security-related headers to protect against common vulnerabilities
// like XSS, clickjacking, MIME sniffing, etc.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
// What it is morgan:
// HTTP request logger middleware.
// What it does:
// Logs incoming requests
// Shows method, URL, status code, response time
//Useful for debugging & monitoring.
app.use(morgan("dev"));

// Cookie parser middleware - MUST come before routes
app.use(cookieParser());

// Middleware to parse JSON bodies
// Increased limit to handle bulk uploads (up to 50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Enable CORS for all routes with credentials support for cookies
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true // Allow cookies to be sent
}));

async function initDB(){
    try {
        
        console.log("Database connected");
    } catch (error) {
        console.error("Database connection failed:", error);
    }
}
app.use(async (req, res, next) => {
  try {
    const decision = await aj.protect(req, {
      requested: 1, // specifies that each request consumes 1 token
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        res.status(429).json({ error: "Too Many Requests" });
      } else if (decision.reason.isBot()) {
        res.status(403).json({ error: "Bot access denied" });
      } else {
        res.status(403).json({ error: "Forbidden" });
      }
      return;
    }

    // check for spoofed bots
    if (decision.results.some((result) => result.reason.isBot() && result.reason.isSpoofed())) {
      res.status(403).json({ error: "Spoofed bot detected" });
      return;
    }

    next();
  } catch (error) {
    console.log("Arcjet error", error);
    next(error);
  }
});
// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Use admin routes for any requests to /admin
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/operator", operatorRoutes);
app.use("/api/faculty", facultyRoutes);
app.use("/api/hod", hodRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/sms", smsRoutes);

initDB().then(() => {
    // Initialize SMS cron job
    initSmsCronJob();
    // Start the server after ensuring DB is initialized
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});