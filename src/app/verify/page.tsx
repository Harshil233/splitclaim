"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "@/styles/Auth.module.css";
import { ShieldCheck } from "lucide-react";

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [emailParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (otp.length !== 6 || isNaN(Number(otp))) {
      setError("Please enter a valid 6-digit OTP code.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to verify account.");
      } else {
        setSuccess("Account verified successfully! Redirecting to login...");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div style={{ display: "inline-flex", padding: "12px", background: "rgba(99, 102, 241, 0.15)", borderRadius: "50%", color: "#818cf8", marginBottom: "16px" }}>
          <ShieldCheck size={32} />
        </div>
        <h1 className={styles.title}>Verify Email</h1>
        <p className={styles.subtitle}>Enter the 6-digit verification code sent to your email</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <div className="input-group">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            placeholder="name@example.com"
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={!!emailParam}
          />
        </div>

        <div className="input-group">
          <label htmlFor="otp">6-Digit Verification Code</label>
          <input
            id="otp"
            type="text"
            placeholder="123456"
            maxLength={6}
            className="input-field"
            style={{ letterSpacing: "8px", textAlign: "center", fontSize: "24px", fontWeight: "bold" }}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            required
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? "Verifying..." : "Verify Account"}
        </button>
      </form>

      <p className={styles.footer}>
        Didn't receive a code?{" "}
        <Link href="/register" className={styles.link}>
          Sign up again
        </Link>
      </p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className={styles.container}>
      <Suspense fallback={
        <div className={styles.card} style={{ textAlign: "center", padding: "40px" }}>
          <p style={{ color: "var(--text-secondary)" }}>Loading verification form...</p>
        </div>
      }>
        <VerifyForm />
      </Suspense>
    </div>
  );
}
