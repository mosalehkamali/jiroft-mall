/**
 * services/adminBootstrap.service.js — the store's first admin.
 *
 *   SUPER_ADMIN_EMAIL=owner@example.com
 *
 * The first Google sign-in with exactly that address — one Google says it has
 * verified — becomes a full-access admin, as long as the store has no active
 * admin yet. After that the setting does nothing; admins are managed in the
 * panel. (Phone/password accounts never qualify: the email on them is typed
 * by the user, not proven.) `npm run seed` remains the other way in.
 */
import Admin from "base/models/Admin";
import AdminRole from "base/models/AdminRole";
import { SUPER_ADMIN_ROLE_NAME, SUPER_ADMIN_SYSTEM_KEY } from "@/lib/permissions";

/** The protected full-access role, created on first need. */
export async function ensureSuperAdminRole() {
  return (
    (await AdminRole.findOne({ systemKey: SUPER_ADMIN_SYSTEM_KEY })) ||
    AdminRole.create({
      name: SUPER_ADMIN_ROLE_NAME,
      description: "همه‌ی دسترسی‌ها — نقشِ محافظت‌شده‌ی سیستم",
      permissions: [],
      isSystem: true,
      isFullAccess: true,
      systemKey: SUPER_ADMIN_SYSTEM_KEY,
    })
  );
}

/** @returns {Promise<boolean>} true when this sign-in just created the first admin */
export async function grantFirstAdmin(user, { emailVerified }) {
  const wanted = String(process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
  const email = String(user?.email || "").trim().toLowerCase();
  if (!wanted || emailVerified !== true || email !== wanted) return false;
  if (await Admin.exists({ isActive: true })) return false; // the store already has an admin
  if (await Admin.exists({ user: user._id })) return false; // a revoked membership stays revoked

  const role = await ensureSuperAdminRole();
  try {
    await Admin.create({
      user: user._id,
      name: [user.name, user.lastName].filter(Boolean).join(" ") || email,
      username: email,
      email,
      role: role._id,
      isActive: true,
    });
  } catch (err) {
    if (err?.code === 11000) return false; // the same sign-in, twice at once
    throw err;
  }
  console.log(`[admin-bootstrap] ${email} is now the store's full-access admin`);
  return true;
}
