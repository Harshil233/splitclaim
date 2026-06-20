"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "@/styles/Dashboard.module.css";
import { Plus, Users, LayoutDashboard, ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface GroupSummary {
  _id: string;
  name: string;
  currency: string;
  members: Array<{ id: string; name: string }>;
  userBalance: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchGroups = async () => {
    try {
      const res = await fetch(`/api/groups?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Failed to fetch groups.");
        return;
      }
      const data = await res.json();
      setGroups(data.groups || []);
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      fetchGroups();
    }
  }, [status]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading your dashboard...</p>
      </div>
    );
  }

  // Calculate totals
  let totalYouAreOwed = 0;
  let totalYouOwe = 0;

  groups.forEach((g) => {
    if (g.userBalance > 0) {
      totalYouAreOwed += g.userBalance;
    } else if (g.userBalance < 0) {
      totalYouOwe += Math.abs(g.userBalance);
    }
  });

  return (
    <div className={styles.container}>
      {/* Greetings Header */}
      <div className={styles.welcomeHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span className={styles.greeting}>Welcome Back</span>
          <h1 className={styles.username}>{session?.user?.name || "User"}</h1>
        </div>
        <button
          onClick={() => fetchGroups()}
          className="btn btn-secondary"
          style={{ width: "auto", padding: "8px 12px" }}
          title="Refresh Dashboard"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Net Summary Balance Cards */}
      <div className={styles.summaryCard}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel} style={{ color: "#34d399" }}>You are owed</span>
          <span className={`${styles.summaryValue} ${styles.valueOwed}`}>
            {formatCurrency(totalYouAreOwed, "INR")}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel} style={{ color: "#f87171" }}>You owe</span>
          <span className={`${styles.summaryValue} ${styles.valueOwe}`}>
            {formatCurrency(totalYouOwe, "INR")}
          </span>
        </div>
      </div>

      {/* Groups List Section */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Your Groups</h2>
        <Link href="/groups/new" className="btn btn-primary ${styles.createBtn}" style={{ width: "auto", padding: "8px 16px", fontSize: "13px" }}>
          <Plus size={14} style={{ display: "inline-block", marginRight: "4px" }} /> New Group
        </Link>
      </div>

      {error && <div className="btn btn-danger" style={{ cursor: "default" }}>{error}</div>}

      <div className={styles.groupsList}>
        {groups.length === 0 ? (
          <div className="glass-card" style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-secondary)", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <LayoutDashboard size={40} style={{ color: "var(--text-muted)" }} />
            <p style={{ fontSize: "14px" }}>No groups created yet. Start by creating a group!</p>
            <Link href="/groups/new" className="btn btn-primary" style={{ width: "auto" }}>
              Create Your First Group
            </Link>
          </div>
        ) : (
          groups.map((group) => (
            <div 
              key={group._id} 
              className={styles.groupCard}
              onClick={() => router.push(`/groups/${group._id}`)}
            >
              <div className={styles.groupMeta}>
                <span className={styles.groupName}>{group.name}</span>
                <span className={styles.groupMembers}>
                  <Users size={12} />
                  {group.members.length} members
                </span>
              </div>
              <div className={styles.groupBalance}>
                {group.userBalance > 0 ? (
                  <>
                    <span className={styles.balanceText}>you are owed</span>
                    <span className={`${styles.balanceAmt} ${styles.amtOwed}`}>
                      {formatCurrency(group.userBalance, group.currency)}
                    </span>
                  </>
                ) : group.userBalance < 0 ? (
                  <>
                    <span className={styles.balanceText}>you owe</span>
                    <span className={`${styles.balanceAmt} ${styles.amtOwe}`}>
                      {formatCurrency(Math.abs(group.userBalance), group.currency)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={styles.balanceText} style={{ opacity: 0.5 }}>status</span>
                    <span className={`${styles.balanceAmt} ${styles.amtSettled}`}>
                      Settled up
                    </span>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
