ALTER TABLE "User" ADD COLUMN "academicYearId" TEXT;
ALTER TABLE "User" ADD COLUMN "semesterId" TEXT;
ALTER TABLE "Course" ADD COLUMN "academicYearId" TEXT;
ALTER TABLE "Course" ADD COLUMN "semesterId" TEXT;

CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "AcademicYear_name_key" ON "AcademicYear"("name");

CREATE TABLE "Semester" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "Semester_name_key" ON "Semester"("name");

CREATE TABLE "CourseAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "assignedClass" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CourseAssignment_courseId_teacherId_key" ON "CourseAssignment"("courseId", "teacherId");
