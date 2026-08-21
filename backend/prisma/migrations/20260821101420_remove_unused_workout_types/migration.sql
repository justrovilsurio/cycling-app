-- AlterEnum
BEGIN;
CREATE TYPE "WorkoutType_new" AS ENUM ('RECOVERY', 'ENDURANCE', 'INTERVAL');
ALTER TABLE "Workout" ALTER COLUMN "type" TYPE "WorkoutType_new" USING ("type"::text::"WorkoutType_new");
ALTER TYPE "WorkoutType" RENAME TO "WorkoutType_old";
ALTER TYPE "WorkoutType_new" RENAME TO "WorkoutType";
DROP TYPE "public"."WorkoutType_old";
COMMIT;

