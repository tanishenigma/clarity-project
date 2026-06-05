import path from "path";
import { connectDB } from "@/lib/db";
import UserModel from "@/lib/models/User";

/**
 * Returns the absolute filesystem path for a user's uploads root.
 * Falls back to <cwd>/uploads when the user has no custom folder set.
 */
export async function getUploadsRoot(userId: string): Promise<string> {
  try {
    await connectDB();
    const user = await UserModel.findById(
      userId,
      "apiSettings.uploadsFolder",
    ).lean();
    const custom = (user?.apiSettings as any)?.uploadsFolder as
      | string
      | undefined;
    if (custom && custom.trim()) {
      return path.resolve(custom.trim());
    }
  } catch {
    // DB failure: use default silently
  }
  return path.join(process.cwd(), "uploads");
}
