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

    // Optional: bootstrap the platform super-admin (product team) from env
    const superEmail = process.env.SUPER_ADMIN_EMAIL;
    const superPassword = process.env.SUPER_ADMIN_PASSWORD;
    if (superEmail && superPassword) {
      await prisma.user.upsert({
        where: { email: superEmail.toLowerCase() },
        update: {},
        create: {
          email: superEmail.toLowerCase(),
          passwordHash: await bcrypt.hash(superPassword, 12),
          name: "Platform Admin",
          role: "SUPER_ADMIN",
          societyId: null,
        },
      });
      console.log("Ensured super-admin:", superEmail);
    }

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
        phone: "+919999999999",
        // Demo account: pre-verified so local development works without email/SMS providers
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
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
