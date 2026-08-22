import express from "express";
import cors from "cors";
import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import meRoutes from "./routes/me.routes";
import profileRoutes from "./routes/profile.routes";
import stravaRoutes from "./routes/strava.routes";
import planRoutes from "./routes/plan.routes";
import workoutRoutes from "./routes/workout.routes";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/me", meRoutes);
app.use("/profile", profileRoutes);
app.use("/auth/strava", stravaRoutes);
app.use("/strava", stravaRoutes);
app.use("/plan", planRoutes);
app.use("/workouts", workoutRoutes);

export default app;
