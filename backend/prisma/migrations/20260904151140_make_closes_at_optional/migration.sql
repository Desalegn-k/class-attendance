-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "classId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "opensAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closesAt" DATETIME,
    "gracePeriodSec" INTEGER NOT NULL DEFAULT 300,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "latitude" REAL,
    "longitude" REAL,
    "radiusMeters" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("classId", "closesAt", "code", "createdAt", "gracePeriodSec", "id", "latitude", "longitude", "opensAt", "qrToken", "radiusMeters", "status") SELECT "classId", "closesAt", "code", "createdAt", "gracePeriodSec", "id", "latitude", "longitude", "opensAt", "qrToken", "radiusMeters", "status" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE UNIQUE INDEX "Session_code_key" ON "Session"("code");
CREATE UNIQUE INDEX "Session_qrToken_key" ON "Session"("qrToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
