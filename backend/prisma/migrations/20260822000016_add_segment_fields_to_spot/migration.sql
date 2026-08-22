-- AlterTable
ALTER TABLE "Spot" ADD COLUMN     "averageGradePercent" DOUBLE PRECISION,
ADD COLUMN     "climbCategory" INTEGER,
ADD COLUMN     "distanceMeters" DOUBLE PRECISION,
ADD COLUMN     "elevationGainMeters" DOUBLE PRECISION,
ADD COLUMN     "maxGradePercent" DOUBLE PRECISION,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "suitableFor" "WorkoutType"[] DEFAULT ARRAY[]::"WorkoutType"[],
ALTER COLUMN "difficulty" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Spot_name_key" ON "Spot"("name");
