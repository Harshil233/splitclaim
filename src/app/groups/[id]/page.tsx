"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "@/styles/Group.module.css";
import { 
  ArrowLeft, Plus, DollarSign, Send, CheckCircle, 
  User, Users, Calendar, Landmark, Info, Share2, Clipboard, RefreshCw
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, calculateDebts, Debt, copyToClipboard } from "@/lib/utils";

interface GroupMember {
  id: string;
  name: string;
  email?: string;
  isGuest: boolean;
}

interface ExpenseSplit {
  memberId: string;
  amount: number;
}

interface ExpenseItem {
  id: string;
  name: string;
  price: number;
  claimedBy: string[];
}

interface Expense {
  _id: string;
  description: string;
  amount: number;
  payerId: string;
  date: string;
  splitType: "equal" | "unequal" | "percentage" | "itemized";
  splits: ExpenseSplit[];
  items?: ExpenseItem[];
  claimToken?: string;
  submittedMembers?: string[];
  createdAt: string;
}

interface Group {
  _id: string;
  name: string;
  description?: string;
  currency: string;
  members: GroupMember[];
  createdBy: string;
}

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<{ [memberId: string]: number }>({});
  const [debts, setDebts] = useState<Debt[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  
  // Settle Up Modal State
  const [settleDebt, setSettleDebt] = useState<Debt | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settling, setSettling] = useState(false);

  // Copy success notification state
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchGroupDetails = async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 403) {
          setError("You do not have permission to view this group.");
        } else if (res.status === 404) {
          setError("Group not found.");
        } else {
          setError("Failed to load group details.");
        }
        return;
      }
      const data = await res.json();
      setGroup(data.group);
      setExpenses(data.expenses);
      calculateBalances(data.group, data.expenses);
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
      fetchGroupDetails();
    }
  }, [status, groupId]);

  const calculateBalances = (groupData: Group, expensesData: Expense[]) => {
    const memberBalances: { [memberId: string]: number } = {};
    
    // Initialize all balances to 0
    groupData.members.forEach((m) => {
      memberBalances[m.id] = 0;
    });

    // Process each expense
    expensesData.forEach((exp) => {
      // Add paid amount to payer's balance (they are owed)
      if (memberBalances[exp.payerId] !== undefined) {
        memberBalances[exp.payerId] += exp.amount;
      }
      
      // Subtract each member's split from their balance (they owe)
      exp.splits.forEach((split) => {
        if (memberBalances[split.memberId] !== undefined) {
          memberBalances[split.memberId] -= split.amount;
        }
      });
    });

    setBalances(memberBalances);

    // Compute minimal debts
    const computedDebts = calculateDebts(
      groupData.members.map((m) => ({ id: m.id, name: m.name })),
      memberBalances
    );
    setDebts(computedDebts);
  };

  const handleOpenSettleUp = (debt: Debt) => {
    setSettleDebt(debt);
    setSettleAmount(parseFloat(debt.amount.toFixed(2)));
  };

  const handleCloseSettleUp = () => {
    setSettleDebt(null);
    setSettleAmount(0);
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleDebt || settleAmount <= 0) return;

    setSettling(true);
    setError("");

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          groupId,
          description: `Settlement: ${settleDebt.fromName} to ${settleDebt.toName}`,
          amount: settleAmount,
          payerId: settleDebt.fromId, // The debtor is the one paying
          splitType: "unequal",
          splits: [
            {
              memberId: settleDebt.toId, // The creditor gets credited the full amount
              amount: settleAmount
            }
          ]
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to record settlement.");
      } else {
        handleCloseSettleUp();
        fetchGroupDetails();
      }
    } catch (err) {
      setError("An unexpected error occurred during settlement.");
    } finally {
      setSettling(false);
    }
  };

  const handleCopyClaimLink = (token: string) => {
    const origin = window.location.origin;
    const url = `${origin}/claim/${token}`;
    copyToClipboard(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading group details...</p>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className={styles.container}>
        <Link href="/dashboard" className="btn btn-secondary" style={{ width: "auto", padding: "8px 16px" }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <div className="btn btn-danger" style={{ cursor: "default", opacity: 0.9, marginTop: "20px" }}>
          {error || "Group not found"}
        </div>
      </div>
    );
  }

  const currentUserEmail = session?.user?.email?.toLowerCase();
  const currentUserId = (session?.user as any)?.id;
  const currentGroupMember = group.members.find(
    (m) => m.id === currentUserId || (m.email && m.email === currentUserEmail)
  );

  const myBalance = currentGroupMember ? (balances[currentGroupMember.id] || 0) : 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Link href="/dashboard" className="btn btn-secondary" style={{ width: "auto", padding: "8px 16px" }}>
          <ArrowLeft size={16} />
          Back
        </Link>
        <h1 className={styles.title}>{group.name}</h1>
        <button
          onClick={() => fetchGroupDetails()}
          className="btn btn-secondary"
          style={{ width: "auto", padding: "8px 16px" }}
          title="Refresh Balances"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {group.description && (
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "-10px", textAlign: "center" }}>
          {group.description}
        </p>
      )}

      {/* Net Balance Box */}
      <div className={styles.balanceGrid}>
        <div className={`${styles.balanceBox} ${myBalance >= 0 ? styles.balanceOwed : styles.balanceOwe}`}>
          <div className={styles.balanceLabel}>
            {myBalance >= 0 ? "You are owed" : "You owe"}
          </div>
          <div className={styles.balanceVal}>
            {formatCurrency(Math.abs(myBalance), group.currency)}
          </div>
        </div>
        <div className={styles.balanceBox} style={{ background: "rgba(255, 255, 255, 0.03)" }}>
          <div className={styles.balanceLabel} style={{ color: "var(--text-secondary)" }}>
            Total Expenses
          </div>
          <div className={styles.balanceVal} style={{ color: "var(--text-primary)" }}>
            {formatCurrency(
              expenses.reduce((acc, curr) => acc + curr.amount, 0),
              group.currency
            )}
          </div>
        </div>
      </div>

      <div className={styles.detailLayout}>
        <div className={styles.leftColumn}>
          {/* Member Balances */}
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>
              <Users size={18} />
              Member Balances
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {group.members.map((m) => {
                const bal = balances[m.id] || 0;
                return (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <span style={{ fontSize: "14px" }}>{m.name}</span>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: bal > 0.01 ? "#34d399" : bal < -0.01 ? "#f87171" : "var(--text-muted)" }}>
                      {bal > 0.01 ? "+" : ""}{formatCurrency(bal, group.currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Suggested Settlements */}
          {debts.length > 0 && (
            <div className={styles.card}>
              <h2 className={styles.sectionTitle}>
                <Landmark size={18} />
                Suggested Settlements
              </h2>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {debts.map((debt, index) => {
                  const isYouPay = currentGroupMember && debt.fromId === currentGroupMember.id;
                  const isYouReceive = currentGroupMember && debt.toId === currentGroupMember.id;
                  
                  return (
                    <div key={index} className={styles.debtRow}>
                      <div className={styles.debtInfo}>
                        <User size={16} className={isYouPay ? "text-danger" : isYouReceive ? "text-success" : "text-muted"} />
                        <span className={styles.debtText}>
                          {isYouPay ? (
                            <>
                              You owe <strong>{debt.toName}</strong>
                            </>
                          ) : isYouReceive ? (
                            <>
                              <strong>{debt.fromName}</strong> owes you
                            </>
                          ) : (
                            <>
                              <strong>{debt.fromName}</strong> owes <strong>{debt.toName}</strong>
                            </>
                          )}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontWeight: 700, fontSize: "14px", color: isYouPay ? "#f87171" : isYouReceive ? "#34d399" : "var(--text-primary)" }}>
                          {formatCurrency(debt.amount, group.currency)}
                        </span>
                        <button 
                          onClick={() => handleOpenSettleUp(debt)} 
                          className={`btn btn-accent ${styles.settleBtn}`}
                        >
                          Settle Up
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className={styles.rightColumn}>
          {/* Expenses List */}
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>
              <Calendar size={18} />
              Expenses History
            </h2>
            
            {expenses.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "14px", padding: "32px 0" }}>
                No expenses recorded yet. Click the + button to add one!
              </p>
            ) : (
              <div className={styles.expenseList}>
                {expenses.map((exp) => {
                  const payer = group.members.find((m) => m.id === exp.payerId);
                  const payerName = payer ? payer.name : "Unknown Payer";
                  const isSettlement = exp.description.startsWith("Settlement:");
                  
                  return (
                    <div key={exp._id} className={styles.expenseCard}>
                      <div className={styles.expenseMeta}>
                        <span className={styles.expenseDesc}>
                          {exp.description}
                        </span>
                        <span className={styles.expenseSub}>
                          Paid by {payerName} • {new Date(exp.date).toLocaleDateString()}
                        </span>
                        {exp.splitType === "itemized" && exp.claimToken && (() => {
                          const total = group.members.length;
                          const submitted = exp.submittedMembers || [];
                          const subCount = group.members.filter((m) => submitted.includes(m.id)).length;
                          const remCount = Math.max(0, total - subCount);
                          
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
                              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyClaimLink(exp.claimToken!);
                                  }}
                                  className={styles.shareBtn}
                                >
                                  {copiedToken === exp.claimToken ? (
                                    <>
                                      <CheckCircle size={12} />
                                      Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Share2 size={12} />
                                      Share Claim Link
                                    </>
                                  )}
                                </button>
                                
                                <span style={{
                                  fontSize: "11px",
                                  fontWeight: "500",
                                  padding: "3px 8px",
                                  borderRadius: "12px",
                                  backgroundColor: remCount === 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.05)",
                                  color: remCount === 0 ? "var(--accent)" : "var(--text-secondary)",
                                  border: `1px solid ${remCount === 0 ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.08)"}`
                                }}>
                                  {remCount === 0 ? (
                                    "🎉 All Claimed!"
                                  ) : (
                                    `${subCount}/${total} Claimed (${remCount} remaining)`
                                  )}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div className={styles.expenseAmountCol}>
                        <span className={styles.expenseAmt}>
                          {formatCurrency(exp.amount, group.currency)}
                        </span>
                        {isSettlement ? (
                          <span className={styles.settlementPill}>Settled</span>
                        ) : (
                          <span className={styles.expenseSplitType}>{exp.splitType}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Add Button */}
      <Link 
        href={`/groups/${groupId}/add-expense`}
        className={styles.floatingAddBtn}
        aria-label="Add expense"
      >
        <Plus size={24} />
      </Link>

      {/* Settle Up Confirmation Modal */}
      {settleDebt && (
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
          zIndex: 100,
          padding: "16px"
        }}>
          <div className={styles.card} style={{ width: "100%", maxWidth: "400px", background: "#131325" }}>
            <h2 className={styles.sectionTitle}>
              <CheckCircle size={20} className="text-success" />
              Confirm Settlement
            </h2>
            <form onSubmit={handleSettleSubmit} className="form" style={{ marginTop: "12px" }}>
              <p style={{ fontSize: "15px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                Record a payment from <strong>{settleDebt.fromName}</strong> to <strong>{settleDebt.toName}</strong>.
              </p>
              
              <div className="input-group">
                <label>Amount Paid ({group.currency})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input-field"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                <button 
                  type="button" 
                  onClick={handleCloseSettleUp} 
                  className="btn btn-secondary"
                  disabled={settling}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={settling}
                >
                  {settling ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
