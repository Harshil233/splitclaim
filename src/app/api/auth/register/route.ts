import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "Please fill in all fields." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    await dbConnect();

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { message: "A user with this email already exists." },
        { status: 400 }
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create the user
    await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      isVerified: false,
      verificationOtp: otp,
      verificationOtpExpires: otpExpires,
    });

    // Send verification email using Resend
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
            to: email.toLowerCase(),
            subject: "Verify your SplitClaim Account",
            html: `
              <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);">
                <h2 style="color: #6366f1; margin-bottom: 16px;">Welcome to SplitClaim!</h2>
                <p style="font-size: 16px; color: #94a3b8;">Use the following One-Time Password (OTP) to verify your email address:</p>
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 6px; padding: 16px 24px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); color: #a5b4fc; border-radius: 8px; display: inline-block; margin: 24px 0; font-family: monospace;">
                  ${otp}
                </div>
                <p style="color: #64748b; font-size: 14px; margin-top: 16px;">This verification code is valid for 15 minutes.</p>
              </div>
            `,
          }),
        });
        const resData = await response.json();
        console.log(`Resend Email API status: ${response.status}`, resData);
      } catch (err) {
        console.error("Resend mailer error:", err);
      }
    }

    return NextResponse.json(
      { 
        message: "Registration successful! Please check your email for the verification code.",
        requiresVerification: true,
        email: email.toLowerCase()
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { message: "An error occurred during registration. Please try again." },
      { status: 500 }
    );
  }
}
