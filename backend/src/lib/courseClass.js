const prisma = require("./prisma");

function courseClassName(course, assignment) {
  return assignment.assignedClass || course.name;
}

async function ensureCourseClass(course, assignment, client = prisma) {
  const name = courseClassName(course, assignment);
  const subject = course.code;

  let cls = await client.class.findFirst({
    where: {
      teacherId: assignment.teacherId,
      subject,
    },
  });

  if (cls) {
    if (cls.name !== name) {
      cls = await client.class.update({
        where: { id: cls.id },
        data: { name },
      });
    }
    return cls;
  }

  return client.class.create({
    data: {
      name,
      subject,
      teacherId: assignment.teacherId,
    },
  });
}

module.exports = { ensureCourseClass };
