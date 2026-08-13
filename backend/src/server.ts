import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { topicsRouter } from "./routes/topics";
import { wordsRouter } from "./routes/words";
import { authRouter } from "./routes/auth";
import { errorHandler } from "./middleware/errorHandler";
import { generalLimiter } from "./middleware/rateLimit";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3001;
const isProduction = process.env.NODE_ENV === "production";

// Railway/Render/Vercel sit in front of the app behind a reverse proxy; this is
// needed for req.ip (used by rate limiting) to reflect the real client IP.
app.set("trust proxy", 1);

// Frontend origins allowed to make cross-site requests with credentials. If the
// production frontend is proxied through the same origin (see vercel.json
// rewrites), this normally stays empty in prod and CORS just blocks everything
// cross-site, which is what we want.
const defaultDevOrigins = ["http://localhost:3000", "http://localhost:3010", "http://localhost:5173"];
const allowedOrigins = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(",").map((o) => o.trim())
  : isProduction
    ? []
    : defaultDevOrigins;

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "100kb" }));
app.use("/api", generalLimiter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/topics", topicsRouter);
app.use("/api/words", wordsRouter);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
