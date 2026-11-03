const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("password123", 10);

  const college = await prisma.college.upsert({
    where: { name: "Main College" },
    update: {},
    create: { name: "Main College" },
  });
  const department = await prisma.department.upsert({
    where: { collegeId_name: { collegeId: college.id, name: "Computer Science" } },
    update: {},
    create: { name: "Computer Science", collegeId: college.id },
  });
  for (const [name, sortOrder] of [["Year 1", 1], ["Year 2", 2], ["Year 3", 3], ["Year 4", 4]]) {
    await prisma.academicYear.upsert({ where: { name }, update: {}, create: { name, sortOrder } });
  }
  for (const [name, sortOrder] of [["Semester 1", 1], ["Semester 2", 2]]) {
    await prisma.semester.upsert({ where: { name }, update: {}, create: { name, sortOrder } });
  }

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@example.com" },
    update: { collegeId: college.id, departmentId: department.id },
    create: { name: "Ms. Rivera", email: "teacher@example.com", passwordHash: password, role: "TEACHER", collegeId: college.id, departmentId: department.id },
  });

  const student1 = await prisma.user.upsert({
    where: { email: "student1@example.com" },
    update: { collegeId: college.id, departmentId: department.id },
    create: { name: "Abebe Bekele", email: "student1@example.com", passwordHash: password, role: "STUDENT", collegeId: college.id, departmentId: department.id },
  });

  const student2 = await prisma.user.upsert({
    where: { email: "student2@example.com" },
    update: { collegeId: college.id, departmentId: department.id },
    create: { name: "Sara Tesfaye", email: "student2@example.com", passwordHash: password, role: "STUDENT", collegeId: college.id, departmentId: department.id },
  });

  const cls = await prisma.class.create({
    data: {
      name: "Intro to Biology",
      subject: "Biology",
      teacherId: teacher.id,
      enrollments: {
        create: [{ studentId: student1.id }, { studentId: student2.id }],
      },
    },
  });

  console.log("Seeded:");
  console.log("  Teacher login: teacher@example.com / password123");
  console.log("  Student login: student1@example.com / password123");
  console.log("  Student login: student2@example.com / password123");
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@example.com",
      passwordHash: password,
      role: "ADMIN",
    },
  });
  console.log("  Admin login: admin@example.com / password123");
  const head = await prisma.user.upsert({
    where: { email: "head@example.com" },
    update: { collegeId: college.id, departmentId: department.id, role: "DEPARTMENT_HEAD" },
    create: {
      name: "Computer Science Department Head",
      email: "head@example.com",
      passwordHash: password,
      role: "DEPARTMENT_HEAD",
      collegeId: college.id,
      departmentId: department.id,
    },
  });
  console.log("  Department head login: head@example.com / password123");
  console.log(`  Class: ${cls.name} (${cls.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
