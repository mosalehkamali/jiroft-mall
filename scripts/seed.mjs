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
import AdminRole from "base/models/AdminRole";
import Category from "base/models/Category";
import Brand from "base/models/Brand";
import Product from "base/models/Product";
import { hash } from "bcryptjs";
import { SUPER_ADMIN_SYSTEM_KEY, SUPER_ADMIN_ROLE_NAME } from "base/src/lib/permissions";
import { isFeatureEnabled } from "base/src/lib/features";

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

async function ensureSuperAdmin({ phone, password, name }) {
  let role = await AdminRole.findOne({ systemKey: SUPER_ADMIN_SYSTEM_KEY });
  if (!role) {
    role = await AdminRole.create({
      name: SUPER_ADMIN_ROLE_NAME,
      description: "همه‌ی دسترسی‌ها — نقشِ محافظت‌شده‌ی سیستم",
      permissions: [],
      isSystem: true,
      isFullAccess: true,
      systemKey: SUPER_ADMIN_SYSTEM_KEY,
    });
    console.log("✓ full-access role created");
  }

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

async function seedDemo() {
  if (await Product.exists({})) {
    console.log("• products already exist — demo catalogue skipped");
    return;
  }
  const brand = isFeatureEnabled("brands")
    ? await Brand.findOneAndUpdate(
        { slug: "sample-brand" },
        { $setOnInsert: { name: "Sample Brand", title: "برند نمونه", slug: "sample-brand" } },
        { upsert: true, returnDocument: "after" },
      )
    : null;

  const make = (title, name, attributes = []) =>
    Category.findOneAndUpdate(
      { name, sport: null },
      { $setOnInsert: { title, name, slug: name, sport: null, attributes } },
      { upsert: true, returnDocument: "after", runValidators: true },
    );
  const clothes = await make("پوشاک", "clothing", [
    { name: "material", label: "جنس", uiType: "text-input", required: false, filterable: true },
  ]);
  const accessories = await make("اکسسوری", "accessories");

  const image = "/brand/placeholder.svg";
  const rows = [
    { name: "تی‌شرت نخی", category: clothes, basePrice: 450000, attributes: { material: "نخ" } },
    { name: "هودی", category: clothes, basePrice: 1250000, attributes: { material: "پنبه" } },
    { name: "کیف دوشی", category: accessories, basePrice: 890000 },
    { name: "کلاه", category: accessories, basePrice: 320000 },
  ];
  for (const r of rows) {
    await Product.create({
      name: r.name,
      shortDescription: `${r.name} — محصول نمونه`,
      category: r.category._id,
      brand: brand?._id || null,
      basePrice: r.basePrice,
      mainImage: image,
      attributes: r.attributes || {},
      isActive: true,
    });
  }
  console.log(`✓ demo catalogue: 2 categories, ${rows.length} products${brand ? ", 1 brand" : ""}`);
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
  if (arg("demo")) await seedDemo();
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("✗", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
