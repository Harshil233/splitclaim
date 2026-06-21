"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/styles/Navbar.module.css";
import { Home, LayoutDashboard, Plus, LogIn, UserPlus, Users, User, Bell } from "lucide-react";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch("/api/activities");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) {
      // silent fail
    }
  };

  useEffect(() => {
    if (session) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 15000);
      return () => clearInterval(interval);
    }
  }, [session, pathname]);

  // Do not render navbar on public claim page (to give maximum screen area for claim checkbox)
  if (pathname?.startsWith("/claim/")) {
    return null;
  }

  const isActive = (path: string) => {
    return pathname === path ? styles.navLinkActive : "";
  };

  return (
    <>
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
                href="/activity" 
                className={`${styles.navLink} ${isActive("/activity")}`}
                style={{ position: "relative" }}
              >
                <Bell size={20} />
                <span>Activity</span>
                {unreadCount > 0 && (
                  <span className={styles.badge}>
                    {unreadCount}
                  </span>
                )}
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

              <Link 
                href="/account" 
                className={`${styles.navLink} ${isActive("/account")}`}
              >
                <User size={20} />
                <span>Account</span>
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
    </>
  );
}


