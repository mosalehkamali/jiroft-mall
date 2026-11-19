/**
 * scripts/seed.mjs — bootstrap a new store's database.
 *
 *   npm run seed -- --phone 09120000000 --password 'secret' --name "مدیر"
 *   npm run seed -- --phone 09120000000 --password 'secret' --demo
 *
 * Idempotent: creates the protected full-access role and the first admin if
 * they don't exist; --demo adds a small sample catalogue (categories, a brand
 * when the brands feature is on, products) so the storefront has something
 * to show. Never touches existing data.
 */
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import User from "base/models/User";
import Admin from "base/models/Admin";
import { hash } from "bcryptjs";
import { ensureSuperAdminRole } from "base/services/adminBootstrap.service";
import { seedDemo } from "./demoCatalogue.mjs";

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

async function ensureSuperAdmin({ phone, password, name }) {
  const role = await ensureSuperAdminRole();

  let user = await User.findOne({ phone });
  if (!user) {
    if (!password) throw new Error("--password is required to create the admin user");
    user = await User.create({
      provider: "local",
      phone,
      phoneVerified: true,
      password: await hash(String(password), 12),
      name,
      role: "user",
    });
    console.log(`✓ user ${phone} created`);
  }

  const membership = await Admin.findOne({ user: user._id });
  if (!membership) {
    await Admin.create({ user: user._id, name, username: phone, role: role._id, isActive: true });
    console.log(`✓ ${phone} is now a full-access admin`);
  } else {
    console.log(`• ${phone} already has an admin membership — left as is`);
  }
}

async function main() {
  const phone = arg("phone");
  if (!phone) {
    console.error("usage: npm run seed -- --phone 09120000000 --password '...' [--name 'مدیر'] [--demo]");
    process.exit(1);
  }
  await connectToDB();
  // autoIndex is off in the app (indexes are built by `npm run ensure:indexes`);
  // build them here too so a fresh database has its unique indexes from day one.
  await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes().catch(() => null)));
  await ensureSuperAdmin({ phone: String(phone), password: arg("password"), name: String(arg("name", "مدیر فروشگاه")) });
  if (arg("demo")) await seedDemo({ adminPhone: String(phone) });
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("✗", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
