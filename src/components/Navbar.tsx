"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/styles/Navbar.module.css";
import { Home, LayoutDashboard, Plus, LogIn, UserPlus, Users, User } from "lucide-react";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

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


