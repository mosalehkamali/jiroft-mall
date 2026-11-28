import "base/models/registerModels";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import User from "base/models/User";
import { verifyToken } from "base/utils/auth";

// Shared read model; authentication is always verified on the server.
export async function readAuthProfile() {
  const token = (await cookies()).get("accessToken")?.value;
  const authUser = token ? verifyToken(token) : null;
  if (!authUser?.userId) return { status: 401, user: null };
  await connectToDB();
  const user = await User.findById(authUser.userId)
    .select("name lastName phone email avatar role walletBalance createdAt");
  if (!user) return { status: 404, user: null };
  return { status: 200, user: {
    id: user._id,
    name: user.name,
    lastName: user.lastName,
    phone: user.phone,
    email: user.email,
    avatar: user.avatar,
    role: user.role === "coach" ? "user" : user.role,
    walletBalance: user.walletBalance || 0,
    createdAt: user.createdAt,
  } };
}
