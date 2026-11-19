// node --test --test-timeout=180000 tests/adminBootstrap.test.mjs
//
// SUPER_ADMIN_EMAIL: only that exact, Google-verified email, and only while the
// store has no active admin, becomes the full-access admin on sign-in.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

register("./aliasHooks.mjs", import.meta.url);

let repl, User, Admin, AdminRole, grantFirstAdmin;

before(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 60000 }] });
  await mongoose.connect(repl.getUri());
  await import("../models/registerModels.js");
  User = mongoose.model("User");
  Admin = mongoose.model("Admin");
  AdminRole = mongoose.model("AdminRole");
  await Promise.all([User.init(), Admin.init(), AdminRole.init()]);
  ({ grantFirstAdmin } = await import("../services/adminBootstrap.service.js"));
});
after(async () => {
  await mongoose.disconnect();
  await repl?.stop();
});

const googleUser = (email, name = "مالک") =>
  User.create({ provider: "google", googleId: `g-${email}`, email, name, role: "user" });

test("nothing happens without SUPER_ADMIN_EMAIL", async () => {
  delete process.env.SUPER_ADMIN_EMAIL;
  const u = await googleUser("owner@example.com");
  assert.equal(await grantFirstAdmin(u, { emailVerified: true }), false);
  assert.equal(await Admin.countDocuments(), 0);
});

test("a stranger signing in first does not become admin", async () => {
  process.env.SUPER_ADMIN_EMAIL = "Owner@Example.com ";
  const stranger = await googleUser("stranger@example.com");
  assert.equal(await grantFirstAdmin(stranger, { emailVerified: true }), false);
  assert.equal(await Admin.countDocuments(), 0);
});

test("the right email is refused while Google has not verified it", async () => {
  const u = await User.findOne({ email: "owner@example.com" });
  assert.equal(await grantFirstAdmin(u, { emailVerified: false }), false);
  assert.equal(await grantFirstAdmin(u, { emailVerified: undefined }), false);
  assert.equal(await Admin.countDocuments(), 0);
});

test("the owner's verified sign-in creates the full-access admin (case-insensitive)", async () => {
  const u = await User.findOne({ email: "owner@example.com" });
  assert.equal(await grantFirstAdmin(u, { emailVerified: true }), true);
  const admin = await Admin.findOne({ user: u._id }).populate("role").lean();
  assert.equal(admin.isActive, true);
  assert.equal(admin.username, "owner@example.com");
  assert.equal(admin.role.isFullAccess, true);
  assert.equal(admin.role.systemKey, "super-admin");

  assert.equal(await grantFirstAdmin(u, { emailVerified: true }), false, "signing in again changes nothing");
  assert.equal(await Admin.countDocuments(), 1);
  assert.equal(await AdminRole.countDocuments(), 1);
});

test("once the store has an admin, the setting grants nothing more", async () => {
  process.env.SUPER_ADMIN_EMAIL = "second@example.com";
  const second = await googleUser("second@example.com");
  assert.equal(await grantFirstAdmin(second, { emailVerified: true }), false);
  assert.equal(await Admin.countDocuments(), 1);
});
