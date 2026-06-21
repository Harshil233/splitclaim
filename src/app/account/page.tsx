"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "@/styles/Account.module.css";
import { 
  User, Bell, Shield, Paintbrush, HelpCircle, 
  Info, ChevronRight, LogOut, RefreshCw 
} from "lucide-react";

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status]);

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

  const handleDummyClick = (settingName: string) => {
    alert(`${settingName} settings are coming soon in a future update!`);
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
            onClick={() => handleDummyClick("Notifications")}
          >
            <div className={styles.settingsItemLeft}>
              <Bell size={18} />
              <span>Notification Settings</span>
            </div>
            <ChevronRight size={16} className={styles.settingsItemRight} />
          </button>
          
          <div className={styles.divider}></div>

          <button 
            className={styles.settingsItem} 
            onClick={() => handleDummyClick("Security & Privacy")}
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
            onClick={() => handleDummyClick("Display & Theme")}
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
            onClick={() => handleDummyClick("Help & Feedback")}
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
            onClick={() => handleDummyClick("About SplitClaim")}
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

      {/* Confirmation Modal */}
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
