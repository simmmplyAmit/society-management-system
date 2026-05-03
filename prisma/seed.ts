import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set in .env");

  const adapter = new PrismaNeon({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log("Seeding database…");

    const society = await prisma.society.upsert({
      where: { id: "demo-society-1" },
      update: {},
      create: {
        id: "demo-society-1",
        name: "Sunrise Residency",
        address: "Plot 12, Sector 21",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
        upiId: "sunrise.residency@upi",
      },
    });

    console.log("Created society:", society.name);

    const passwordHash = await bcrypt.hash("admin123", 12);

    const admin = await prisma.user.upsert({
      where: { email: "admin@sunrise.com" },
      update: {},
      create: {
        email: "admin@sunrise.com",
        passwordHash,
        name: "Society Admin",
        role: "ADMIN",
        societyId: society.id,
      },
    });

    console.log("Created admin:", admin.email);
    console.log("\n✓ Login credentials:");
    console.log("  Email:    admin@sunrise.com");
    console.log("  Password: admin123");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
