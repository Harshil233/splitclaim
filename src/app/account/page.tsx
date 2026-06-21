"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "@/styles/Account.module.css";
import { 
  User, Shield, Paintbrush, HelpCircle, 
  Info, ChevronRight, LogOut, Lock, Key, 
  Mail, X, ScanLine, Share2, Users, Printer, Check
} from "lucide-react";

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Dialog / Modal Visibility States
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [activeModal, setActiveModal] = useState<"security" | "changePassword" | "resetPasswordRequest" | "resetPasswordVerify" | "feedback" | "about" | null>(null);

  // Form input states
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  // Change password states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [loadingPassword, setLoadingPassword] = useState(false);

  // Reset password states
  const [resetOtp, setResetOtp] = useState("");
  const [receivedOtp, setReceivedOtp] = useState(""); // Mock OTP display
  const [loadingResetReq, setLoadingResetReq] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status]);

  // Pre-fill feedback form with user session details
  useEffect(() => {
    if (session?.user) {
      setFeedbackName(session.user.name || "");
      setFeedbackEmail(session.user.email || "");
    }
  }, [session]);

  if (status === "loading" || !session) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading account details...</p>
      </div>
    );
  }

  const user = session.user;
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "U";

  const handleDummyThemeClick = () => {
    alert("Display & Theme options are coming soon in a future update!");
  };

  // Feedback form submit
  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setFeedbackSuccess(true);
    setTimeout(() => {
      setFeedbackSuccess(false);
      setFeedbackText("");
      setActiveModal(null);
    }, 2000);
  };

  // Change password submit
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long.");
      return;
    }

    setLoadingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.message || "Failed to update password.");
      } else {
        setPasswordSuccess("Password updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          setPasswordSuccess("");
          setActiveModal(null);
        }, 1500);
      }
    } catch (err) {
      setPasswordError("An unexpected error occurred.");
    } finally {
      setLoadingPassword(false);
    }
  };

  // Reset password OTP request
  const handleResetPasswordRequest = async () => {
    setPasswordError("");
    setLoadingResetReq(true);
    try {
      const res = await fetch("/api/auth/reset-password-request", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        if (data.emailSent) {
          alert("Verification code has been sent to your email!");
        } else if (data.mockOtp) {
          setReceivedOtp(data.mockOtp);
        }
        setActiveModal("resetPasswordVerify");
      } else {
        setPasswordError(data.message || "Failed to send verification code.");
      }
    } catch (err) {
      setPasswordError("An unexpected error occurred.");
    } finally {
      setLoadingResetReq(false);
    }
  };

  // Reset password OTP verification and save
  const handleResetPasswordVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setLoadingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isReset: true,
          resetOtp,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.message || "Failed to reset password.");
      } else {
        setPasswordSuccess("Password reset successfully!");
        setResetOtp("");
        setNewPassword("");
        setConfirmPassword("");
        setReceivedOtp("");
        setTimeout(() => {
          setPasswordSuccess("");
          setActiveModal(null);
        }, 1500);
      }
    } catch (err) {
      setPasswordError("An unexpected error occurred.");
    } finally {
      setLoadingPassword(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Title */}
      <div>
        <h1 className={styles.title}>Account</h1>
        <span className={styles.subtitle}>Manage your profile and application preferences</span>
      </div>

      {/* Profile Card */}
      <div className={styles.profileCard}>
        <div className={styles.avatar}>{initials}</div>
        <div className={styles.profileInfo}>
          <span className={styles.name}>{user?.name || "User Name"}</span>
          <span className={styles.email}>{user?.email || "user@example.com"}</span>
        </div>
      </div>

      {/* Preferences Section */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>App Preferences</h2>
        <div className={styles.settingsList}>
          <button 
            className={styles.settingsItem} 
            onClick={() => setActiveModal("security")}
          >
            <div className={styles.settingsItemLeft}>
              <Shield size={18} />
              <span>Security & Passcode</span>
            </div>
            <ChevronRight size={16} className={styles.settingsItemRight} />
          </button>

          <div className={styles.divider}></div>

          <button 
            className={styles.settingsItem} 
            onClick={handleDummyThemeClick}
          >
            <div className={styles.settingsItemLeft}>
              <Paintbrush size={18} />
              <span>Display & Theme</span>
            </div>
            <ChevronRight size={16} className={styles.settingsItemRight} />
          </button>
        </div>
      </div>

      {/* Support Section */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Support & About</h2>
        <div className={styles.settingsList}>
          <button 
            className={styles.settingsItem} 
            onClick={() => {
              setFeedbackSuccess(false);
              setActiveModal("feedback");
            }}
          >
            <div className={styles.settingsItemLeft}>
              <HelpCircle size={18} />
              <span>Help & Feedback</span>
            </div>
            <ChevronRight size={16} className={styles.settingsItemRight} />
          </button>

          <div className={styles.divider}></div>

          <button 
            className={styles.settingsItem} 
            onClick={() => setActiveModal("about")}
          >
            <div className={styles.settingsItemLeft}>
              <Info size={18} />
              <span>About SplitClaim</span>
            </div>
            <ChevronRight size={16} className={styles.settingsItemRight} />
          </button>
        </div>
      </div>

      {/* Sign Out Button */}
      <div className={styles.signOutSection}>
        <button 
          onClick={() => setShowSignOutConfirm(true)}
          className={styles.signOutBtn}
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>

      {/* ----------------- MODALS & DRAWERS ----------------- */}

      {/* Security Choices Modal */}
      {activeModal === "security" && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className={styles.modalTitle} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield size={20} className="text-accent" />
                Security Settings
              </h3>
              <button onClick={() => setActiveModal(null)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
            
            <p className={styles.modalDescription}>
              Select an action to update or recover your login credentials securely.
            </p>

            <div className={styles.securityBtnGroup}>
              <button 
                onClick={() => {
                  setPasswordError("");
                  setPasswordSuccess("");
                  setActiveModal("changePassword");
                }}
                className={styles.securityBtn}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Key size={16} />
                <span>Change Password</span>
              </button>

              <button 
                onClick={handleResetPasswordRequest}
                className={styles.securityBtn}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
                disabled={loadingResetReq}
              >
                <Mail size={16} />
                <span>{loadingResetReq ? "Sending code..." : "Reset via Email Code"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {activeModal === "changePassword" && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: "440px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className={styles.modalTitle}>Change Password</h3>
              <button onClick={() => setActiveModal("security")} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {passwordError && <div className="btn btn-danger" style={{ cursor: "default", fontSize: "12px", padding: "8px" }}>{passwordError}</div>}
            {passwordSuccess && <div className="btn btn-accent" style={{ cursor: "default", fontSize: "12px", padding: "8px", background: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.3)", color: "#34d399" }}>{passwordSuccess}</div>}

            <form onSubmit={handleChangePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Current Password</label>
                <input 
                  type="password" 
                  className={styles.formInput} 
                  value={currentPassword} 
                  onChange={(e) => setCurrentPassword(e.target.value)} 
                  required 
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>New Password</label>
                <input 
                  type="password" 
                  className={styles.formInput} 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  placeholder="At least 6 characters"
                  required 
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Confirm New Password</label>
                <input 
                  type="password" 
                  className={styles.formInput} 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  required 
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button type="button" onClick={() => setActiveModal("security")} className="btn btn-secondary" style={{ width: "auto" }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={loadingPassword}>
                  {loadingPassword ? "Updating..." : "Save Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verify OTP & Reset Password Modal */}
      {activeModal === "resetPasswordVerify" && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: "440px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className={styles.modalTitle}>Verify Code & Reset</h3>
              <button onClick={() => setActiveModal("security")} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {receivedOtp && (
              <div style={{ background: "rgba(99, 102, 241, 0.15)", border: "1px solid rgba(99, 102, 241, 0.3)", padding: "12px", borderRadius: "8px", color: "#a5b4fc", fontSize: "13px" }}>
                <span style={{ fontWeight: 700, display: "block", marginBottom: "4px" }}>Local Test Verification Code:</span>
                We simulated sending a verification email. Use the code: <strong style={{ color: "white", fontSize: "16px", letterSpacing: "1px", fontFamily: "monospace" }}>{receivedOtp}</strong> to verify.
              </div>
            )}

            {passwordError && <div className="btn btn-danger" style={{ cursor: "default", fontSize: "12px", padding: "8px" }}>{passwordError}</div>}
            {passwordSuccess && <div className="btn btn-accent" style={{ cursor: "default", fontSize: "12px", padding: "8px", background: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.3)", color: "#34d399" }}>{passwordSuccess}</div>}

            <form onSubmit={handleResetPasswordVerifySubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>6-Digit Verification Code</label>
                <input 
                  type="text" 
                  maxLength={6}
                  placeholder="Enter OTP"
                  className={styles.formInput} 
                  value={resetOtp} 
                  onChange={(e) => setResetOtp(e.target.value)} 
                  style={{ textAlign: "center", fontSize: "18px", letterSpacing: "2px", fontFamily: "monospace" }}
                  required 
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>New Password</label>
                <input 
                  type="password" 
                  className={styles.formInput} 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  placeholder="At least 6 characters"
                  required 
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Confirm Password</label>
                <input 
                  type="password" 
                  className={styles.formInput} 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  required 
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button type="button" onClick={() => setActiveModal("security")} className="btn btn-secondary" style={{ width: "auto" }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ width: "auto" }} disabled={loadingPassword}>
                  {loadingPassword ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Help & Feedback Modal */}
      {activeModal === "feedback" && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: "460px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className={styles.modalTitle} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <HelpCircle size={20} className="text-accent" />
                Help & Feedback
              </h3>
              <button onClick={() => setActiveModal(null)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {feedbackSuccess ? (
              <div style={{ textAlign: "center", padding: "24px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#34d399" }}>
                  <Check size={24} />
                </div>
                <h4 style={{ margin: 0, fontSize: "16px", color: "white" }}>Feedback Submitted!</h4>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>Thank you for helping us improve SplitClaim.</p>
              </div>
            ) : (
              <form onSubmit={handleFeedbackSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Your Name</label>
                  <input 
                    type="text" 
                    className={styles.formInput} 
                    value={feedbackName} 
                    onChange={(e) => setFeedbackName(e.target.value)} 
                    required 
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Email Address</label>
                  <input 
                    type="email" 
                    className={styles.formInput} 
                    value={feedbackEmail} 
                    onChange={(e) => setFeedbackEmail(e.target.value)} 
                    required 
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Message or Feedback</label>
                  <textarea 
                    className={`${styles.formInput} ${styles.formTextarea}`} 
                    value={feedbackText} 
                    onChange={(e) => setFeedbackText(e.target.value)} 
                    placeholder="Describe your issue, ask a question, or leave feedback..."
                    required 
                  />
                </div>

                <div style={{ display: "flex", gap: "12px", marginTop: "6px" }}>
                  <button type="button" onClick={() => setActiveModal(null)} className="btn btn-secondary" style={{ width: "auto" }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>
                    Send Feedback
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* About SplitClaim Modal */}
      {activeModal === "about" && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: "500px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className={styles.modalTitle} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Info size={20} className="text-accent" />
                About SplitClaim
              </h3>
              <button onClick={() => setActiveModal(null)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
              <p style={{ margin: "0 0 12px 0" }}>
                <strong>SplitClaim</strong> is a mobile-optimized bill-splitting application built to make sharing group expenses effortless.
              </p>
              
              <div className={styles.aboutList}>
                <div className={styles.aboutItem}>
                  <ScanLine size={18} className={styles.aboutIcon} />
                  <div className={styles.aboutText}>
                    <span className={styles.aboutItemTitle}>Scan & Extract Items</span>
                    <span className={styles.aboutItemDesc}>Add or scan a bill to extract items and prices instantly. Generate a shareable URL to split unequally based on what was consumed.</span>
                  </div>
                </div>

                <div className={styles.aboutItem}>
                  <Share2 size={18} className={styles.aboutIcon} />
                  <div className={styles.aboutText}>
                    <span className={styles.aboutItemTitle}>Shareable Claim Links</span>
                    <span className={styles.aboutItemDesc}>Generate a public claim link. Friends select their name and check off their items—no login or sign-up required for guests.</span>
                  </div>
                </div>

                <div className={styles.aboutItem}>
                  <Users size={18} className={styles.aboutIcon} />
                  <div className={styles.aboutText}>
                    <span className={styles.aboutItemTitle}>Flexible Splitting Modes</span>
                    <span className={styles.aboutItemDesc}>Full support for traditional splits (equal, unequal, percentage) alongside itemized claims. Unclaimed items split equally or assign to payer.</span>
                  </div>
                </div>

                <div className={styles.aboutItem}>
                  <Printer size={18} className={styles.aboutIcon} />
                  <div className={styles.aboutText}>
                    <span className={styles.aboutItemTitle}>Export PDF Reports</span>
                    <span className={styles.aboutItemDesc}>Generate and export comprehensive trip ledgers and audit reports to PDF. Keep clean settlement history and print sheets whenever you need.</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "12px", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--text-muted)" }}>
              <span>Version 1.0.0 (Next.js 15)</span>
              <span>&copy; {new Date().getFullYear()} SplitClaim</span>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Sign Out Modal */}
      {showSignOutConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Confirm Sign Out</h3>
            <p className={styles.modalDescription}>
              Are you sure you want to sign out of SplitClaim?
            </p>
            <div className={styles.modalActions}>
              <button 
                onClick={() => setShowSignOutConfirm(false)}
                className="btn btn-secondary"
                style={{ width: "auto" }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShowSignOutConfirm(false);
                  signOut({ callbackUrl: "/" });
                }}
                className="btn btn-danger"
                style={{ width: "auto" }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
