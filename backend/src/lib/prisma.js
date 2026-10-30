const { PrismaClient } = require("@prisma/client");

// Reuse a single PrismaClient instance across the app (recommended by Prisma docs)
const prisma = new PrismaClient();

module.exports = prisma;
