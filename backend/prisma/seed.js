const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("password123", 10);

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@example.com" },
    update: {},
    create: { name: "Ms. Rivera", email: "teacher@example.com", passwordHash: password, role: "TEACHER" },
  });

  const student1 = await prisma.user.upsert({
    where: { email: "student1@example.com" },
    update: {},
    create: { name: "Abebe Bekele", email: "student1@example.com", passwordHash: password, role: "STUDENT" },
  });

  const student2 = await prisma.user.upsert({
    where: { email: "student2@example.com" },
    update: {},
    create: { name: "Sara Tesfaye", email: "student2@example.com", passwordHash: password, role: "STUDENT" },
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
  console.log(`  Class: ${cls.name} (${cls.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
