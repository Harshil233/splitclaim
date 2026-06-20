"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import styles from "@/styles/Home.module.css";
import { Sparkles, ScanLine, Users, Share2, ArrowRight, Printer } from "lucide-react";

export default function HomePage() {
  const { data: session } = useSession();

  return (
    <div className={styles.hero}>
      <div className={styles.hero}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(99, 102, 241, 0.15)", border: "1px solid rgba(99, 102, 241, 0.3)", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", color: "#a5b4fc", fontWeight: 600 }}>
          <Sparkles size={12} /> Mobile-Optimized Bill Splitting
        </div>
        <h1 className={styles.title}>Split Bills.<br />Claim Your Share.</h1>
        <p className={styles.subtitle}>
          The easiest way to split group expenses. Add or scan a bill to extract items instantly, and share links for friends to claim what they consumed.
        </p>

        <div className={styles.ctaGroup}>
          {session ? (
            <Link href="/dashboard" className="btn btn-primary">
              Go to Dashboard
              <ArrowRight size={16} />
            </Link>
          ) : (
            <>
              <Link href="/register" className="btn btn-primary">
                Get Started for Free
              </Link>
              <Link href="/login" className="btn btn-secondary">
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>

      <div className={styles.featuresGrid}>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>
            <ScanLine size={20} />
          </div>
          <div className={styles.featureMeta}>
            <h3 className={styles.featureTitle}>Scan & Extract Items</h3>
            <p className={styles.featureDesc}>
              Add or scan a bill to extract items and prices instantly. Generate a shareable URL to split unequally across friends based on what they consumed.
            </p>
          </div>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>
            <Share2 size={20} />
          </div>
          <div className={styles.featureMeta}>
            <h3 className={styles.featureTitle}>Shareable Claim Links</h3>
            <p className={styles.featureDesc}>
              Generate a public claim link. Friends select their name and check off their items—no login or sign-up required for guests.
            </p>
          </div>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>
            <Users size={20} />
          </div>
          <div className={styles.featureMeta}>
            <h3 className={styles.featureTitle}>Flexible Splitting</h3>
            <p className={styles.featureDesc}>
              Support for traditional splits (equal, unequal, percentage) alongside itemized claims. Unclaimed items split equally or assign to host.
            </p>
          </div>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>
            <Printer size={20} />
          </div>
          <div className={styles.featureMeta}>
            <h3 className={styles.featureTitle}>Export PDF Reports</h3>
            <p className={styles.featureDesc}>
              Generate and export comprehensive trip ledgers and audit reports to PDF. Keep clean settlement history and print sheets whenever you need.
            </p>
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <p>&copy; {new Date().getFullYear()} SplitClaim. Built with Next.js, Mongoose, and Tesseract.js.</p>
      </footer>
    </div>
  );
}
