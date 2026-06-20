"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import styles from "@/styles/Navbar.module.css";
import { Home, LayoutDashboard, Plus, LogIn, UserPlus, LogOut, Users } from "lucide-react";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // Do not render navbar on public claim page (to give maximum screen area for claim checkbox)
  if (pathname?.startsWith("/claim/")) {
    return null;
  }

  const isActive = (path: string) => {
    return pathname === path ? styles.navLinkActive : "";
  };

  return (
    <>
      {session && (
        <button 
          onClick={() => setShowSignOutConfirm(true)}
          className={styles.signOutFloat}
          title="Sign Out"
        >
          <LogOut size={20} />
        </button>
      )}

      <nav className={styles.nav}>
        <div className={styles.navInner}>
          {session ? (
            <>
              <Link 
                href="/dashboard" 
                className={`${styles.navLink} ${isActive("/dashboard")}`}
              >
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </Link>

              <Link 
                href="/groups/new" 
                className={`${styles.navLink} ${styles.plusButton}`}
                title="Create Group"
              >
                <Plus size={24} />
              </Link>

              <Link 
                href="/friends" 
                className={`${styles.navLink} ${isActive("/friends")}`}
              >
                <Users size={20} />
                <span>Friends</span>
              </Link>
            </>
          ) : (
            <>
              <Link 
                href="/" 
                className={`${styles.navLink} ${isActive("/")}`}
              >
                <Home size={20} />
                <span>Home</span>
              </Link>

              <Link 
                href="/login" 
                className={`${styles.navLink} ${isActive("/login")}`}
              >
                <LogIn size={20} />
                <span>Sign In</span>
              </Link>

              <Link 
                href="/register" 
                className={`${styles.navLink} ${isActive("/register")}`}
              >
                <UserPlus size={20} />
                <span>Register</span>
              </Link>
            </>
          )}
        </div>
      </nav>

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
    </>
  );
}


