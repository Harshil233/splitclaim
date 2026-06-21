"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "@/styles/Friends.module.css";
import { 
  Users, User, Landmark, CheckCircle, RefreshCw, 
  ArrowLeft, ChevronRight, AlertTriangle, Plus, Check
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface SharedGroup {
  groupId: string;
  groupName: string;
  userMemberId: string;
  friendMemberId: string;
  balance: number;
}

interface Friend {
  name: string;
  email?: string;
  netBalance: number;
  sharedGroups: SharedGroup[];
}

export default function FriendsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Settle Up Modal State
  const [settleFriend, setSettleFriend] = useState<Friend | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState("");
  const [resolvingFriend, setResolvingFriend] = useState<string | null>(null);

  const fetchFriends = async () => {
    try {
      const res = await fetch(`/api/friends?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Failed to fetch friends details.");
        return;
      }
      const data = await res.json();
      setFriends(data.friends || []);
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
      fetchFriends();
    }
  }, [status]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading your friends list...</p>
      </div>
    );
  }

  // Calculate overall summary totals
  let totalOwedToYou = 0;
  let totalYouOwe = 0;

  friends.forEach((f) => {
    if (f.netBalance > 0) {
      totalOwedToYou += f.netBalance;
    } else if (f.netBalance < 0) {
      totalYouOwe += Math.abs(f.netBalance);
    }
  });

  const handleOpenSettle = (friend: Friend) => {
    setSettleFriend(friend);
    setSettleAmount(parseFloat(Math.abs(friend.netBalance).toFixed(2)));
    setSettleError("");
  };

  const handleCloseSettle = () => {
    setSettleFriend(null);
    setSettleAmount(0);
    setSettleError("");
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleFriend || settleAmount <= 0) return;

    setSettling(true);
    setSettleError("");

    // Determine direction based on the net balance
    // If balance is negative, user owes friend, so direction is "user_to_friend" (user paid friend)
    // If balance is positive, friend owes user, so direction is "friend_to_user" (friend paid user)
    const direction = settleFriend.netBalance < 0 ? "user_to_friend" : "friend_to_user";

    try {
      const res = await fetch("/api/friends/settle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          friendEmail: settleFriend.email,
          friendName: settleFriend.name,
          amount: settleAmount,
          direction,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSettleError(data.message || "Failed to record settlement.");
      } else {
        handleCloseSettle();
        fetchFriends();
      }
    } catch (err) {
      setSettleError("An unexpected error occurred during settlement.");
    } finally {
      setSettling(false);
    }
  };

  const handleFriendClick = async (friend: Friend) => {
    if (resolvingFriend) return;
    setResolvingFriend(friend.name);
    try {
      const res = await fetch("/api/groups/one-on-one", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          friendName: friend.name,
          friendEmail: friend.email,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/groups/${data.groupId}`);
      } else {
        alert("Failed to access/create direct group with friend.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while opening direct split group.");
    } finally {
      setResolvingFriend(null);
    }
  };

  return (
    <div className={styles.container}>
      {/* Back button and title */}
      <div className={styles.welcomeHeader} style={{ flexDirection: "column", alignItems: "stretch", gap: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/dashboard" className="btn btn-secondary" style={{ width: "auto", padding: "6px 12px", display: "inline-flex", gap: "6px", alignItems: "center", textDecoration: "none", fontSize: "12px" }}>
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <button
            onClick={fetchFriends}
            className="btn btn-secondary"
            style={{ width: "auto", padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "center" }}
            title="Refresh Friends"
          >
            <RefreshCw size={16} />
          </button>
        </div>
        <div>
          <h1 className={styles.title}>Friend Balances</h1>
          <span className={styles.subtitle}>Combined net balances with friends across all groups</span>
        </div>
      </div>

      {/* Net Summary Cards */}
      <div className={styles.summaryCard}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel} style={{ color: "#34d399" }}>Overall owed to you</span>
          <span className={`${styles.summaryValue} ${styles.valueOwed}`}>
            {formatCurrency(totalOwedToYou, "INR")}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel} style={{ color: "#f87171" }}>Overall you owe</span>
          <span className={`${styles.summaryValue} ${styles.valueOwe}`}>
            {formatCurrency(totalYouOwe, "INR")}
          </span>
        </div>
      </div>

      {/* Friends List Header */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <Users size={18} />
          Your Friends
        </h2>
      </div>

      {error && <div className="btn btn-danger" style={{ cursor: "default" }}>{error}</div>}

      {/* Friends Listing */}
      <div className={styles.friendsList}>
        {friends.length === 0 ? (
          <div className="glass-card" style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-secondary)", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <Users size={40} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
            <p style={{ fontSize: "14px" }}>No friends found in any of your groups.</p>
          </div>
        ) : (
          friends.map((friend, index) => {
            const initials = friend.name ? friend.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "F";
            const bal = friend.netBalance;

            return (
              <div 
                key={index} 
                className={`${styles.friendCard} ${resolvingFriend === friend.name ? styles.resolving : ""}`}
                onClick={() => handleFriendClick(friend)}
              >
                <div className={styles.friendLeft}>
                  <div className={styles.avatar}>{initials}</div>
                  <div className={styles.friendMeta}>
                    <span className={styles.friendName}>{friend.name}</span>
                    {friend.email && <span className={styles.friendSub}>{friend.email}</span>}
                    
                    {/* List of groups shared */}
                    <div className={styles.groupsList} onClick={(e) => e.stopPropagation()}>
                      {friend.sharedGroups.map((sg, idx) => (
                        <Link 
                          key={idx}
                          href={`/groups/${sg.groupId}`}
                          className={styles.groupBadge}
                          title={`Balance in group: ${sg.balance >= 0 ? "+" : ""}${sg.balance}`}
                          style={{ textDecoration: "none", cursor: "pointer" }}
                        >
                          {sg.groupName} ({sg.balance > 0 ? `+₹${sg.balance}` : sg.balance < 0 ? `-₹${Math.abs(sg.balance)}` : "settled"})
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={styles.friendRight} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.friendBalance}>
                    {bal > 0.01 ? (
                      <>
                        <span className={styles.balanceText}>owes you</span>
                        <span className={`${styles.balanceAmt} ${styles.amtOwed}`}>
                          {formatCurrency(bal, "INR")}
                        </span>
                      </>
                    ) : bal < -0.01 ? (
                      <>
                        <span className={styles.balanceText}>you owe</span>
                        <span className={`${styles.balanceAmt} ${styles.amtOwe}`}>
                          {formatCurrency(Math.abs(bal), "INR")}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={styles.balanceText}>status</span>
                        <span className={`${styles.balanceAmt} ${styles.amtSettled}`}>
                          Settled up
                        </span>
                      </>
                    )}
                  </div>
                  
                  {Math.abs(bal) > 0.01 && (
                    <button
                      onClick={() => handleOpenSettle(friend)}
                      className={`btn btn-accent ${styles.settleBtn}`}
                    >
                      Settle Up
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Combined Settle Up Modal */}
      {settleFriend && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 110,
          padding: "16px"
        }}>
          <div className="glass-card" style={{ width: "100%", maxWidth: "450px", background: "#131325", padding: "24px", borderRadius: "12px", border: "1px solid var(--card-border)", maxHeight: "calc(100vh - 40px)", overflowY: "auto" }}>
            <h2 className={styles.sectionTitle} style={{ fontSize: "18px", fontWeight: 700 }}>
              <CheckCircle size={20} className="text-success" style={{ flexShrink: 0 }} />
              Settle Combined Debts
            </h2>
            
            <form onSubmit={handleSettleSubmit} className="form" style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {settleError && (
                <div className="btn btn-danger" style={{ cursor: "default", padding: "8px", fontSize: "12px" }}>
                  {settleError}
                </div>
              )}
              
              <div style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                <p>
                  You are recording a combined settlement payment with <strong>{settleFriend.name}</strong>.
                </p>
                <div style={{ marginTop: "10px", padding: "10px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Net Combined Balance:</span>
                  <span style={{ fontWeight: 800, color: settleFriend.netBalance >= 0 ? "#34d399" : "#f87171" }}>
                    {settleFriend.netBalance >= 0 ? `${settleFriend.name} owes you` : `You owe ${settleFriend.name}`} {formatCurrency(Math.abs(settleFriend.netBalance), "INR")}
                  </span>
                </div>
              </div>

              <div className="input-group">
                <label>Amount Settled (INR)</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  className="input-field"
                  value={settleAmount || ""}
                  onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>

              {/* Distribute summary info */}
              <div style={{ fontSize: "12px", background: "rgba(99, 102, 241, 0.05)", border: "1px solid rgba(99, 102, 241, 0.15)", borderRadius: "8px", padding: "12px", color: "#a5b4fc" }}>
                <span style={{ fontWeight: 700, display: "block", marginBottom: "6px", textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.5px" }}>
                  Debts distribution plan:
                </span>
                <p style={{ margin: "0 0 8px 0" }}>
                  Recording this payment will automatically create settlement sheets inside the following shared groups:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {settleFriend.sharedGroups
                    .filter(sg => settleFriend.netBalance < 0 ? sg.balance < -0.01 : sg.balance > 0.01)
                    .map((sg, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", opacity: 0.9 }}>
                        <span>• {sg.groupName}</span>
                        <span style={{ fontWeight: 650 }}>{formatCurrency(Math.abs(sg.balance), "INR")}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button 
                  type="button" 
                  onClick={handleCloseSettle} 
                  className="btn btn-secondary"
                  disabled={settling}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={settling || settleAmount <= 0}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                >
                  {settling ? (
                    "Recording..."
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Record Settlement</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
