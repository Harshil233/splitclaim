import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findOne({ email: session.user.email?.toLowerCase() });
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.verificationOtp = otp;
    user.verificationOtpExpires = otpExpires;
    await user.save();

    let emailSent = false;
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "SplitClaim <onboarding@resend.dev>",
            to: user.email,
            subject: "Reset your SplitClaim Password",
            html: `
              <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);">
                <h2 style="color: #6366f1; margin-bottom: 16px;">Password Reset Request</h2>
                <p style="font-size: 16px; color: #94a3b8;">Use the following One-Time Password (OTP) to reset your password:</p>
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 6px; padding: 16px 24px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); color: #a5b4fc; border-radius: 8px; display: inline-block; margin: 24px 0; font-family: monospace;">
                  ${otp}
                </div>
                <p style="color: #64748b; font-size: 14px; margin-top: 16px;">This reset code is valid for 15 minutes.</p>
              </div>
            `,
          }),
        });
        if (response.ok) {
          emailSent = true;
        }
      } catch (err) {
        console.error("Resend reset mailer error:", err);
      }
    }

    return NextResponse.json({
      success: true,
      emailSent,
      // For local testing without Resend configured, return the OTP in the response
      mockOtp: emailSent ? undefined : otp,
    });
  } catch (error: any) {
    console.error("Reset password request error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
