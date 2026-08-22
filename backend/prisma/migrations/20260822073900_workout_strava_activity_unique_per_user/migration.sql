-- DropIndex
DROP INDEX "Workout_stravaActivityId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Workout_userId_stravaActivityId_key" ON "Workout"("userId", "stravaActivityId");

