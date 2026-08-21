-- AlterTable
ALTER TABLE "Workout" ADD COLUMN     "avgHeartRate" DOUBLE PRECISION,
ADD COLUMN     "distanceMeters" DOUBLE PRECISION,
ADD COLUMN     "durationSeconds" INTEGER,
ADD COLUMN     "stravaActivityId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Workout_stravaActivityId_key" ON "Workout"("stravaActivityId");

