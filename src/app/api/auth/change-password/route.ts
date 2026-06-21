import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword, isReset, resetOtp } = await req.json();

    await dbConnect();
    const user = await User.findOne({ email: session.user.email?.toLowerCase() });
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (isReset) {
      if (!user.verificationOtp || user.verificationOtp !== resetOtp) {
        return NextResponse.json({ message: "Invalid verification code" }, { status: 400 });
      }
      if (user.verificationOtpExpires && new Date() > user.verificationOtpExpires) {
        return NextResponse.json({ message: "Verification code has expired" }, { status: 400 });
      }

      if (newPassword.length < 6) {
        return NextResponse.json({ message: "Password must be at least 6 characters long" }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      user.password = hashedPassword;
      user.verificationOtp = undefined;
      user.verificationOtpExpires = undefined;
      await user.save();

      return NextResponse.json({ success: true, message: "Password reset successfully!" });
    } else {
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ message: "Missing current or new password" }, { status: 400 });
      }

      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return NextResponse.json({ message: "Incorrect current password" }, { status: 400 });
      }

      if (newPassword.length < 6) {
        return NextResponse.json({ message: "New password must be at least 6 characters long" }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      user.password = hashedPassword;
      await user.save();

      return NextResponse.json({ success: true, message: "Password updated successfully!" });
    }
  } catch (error: any) {
    console.error("Change password error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
