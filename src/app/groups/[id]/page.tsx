"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "@/styles/Group.module.css";
import { 
  ArrowLeft, Plus, CheckCircle, 
  User, Users, Calendar, Landmark, Share2, RefreshCw,
  Edit2, Trash2, ChevronDown, ChevronUp, FileText
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, calculateDebts, Debt, copyToClipboard } from "@/lib/utils";
import EditExpenseForm from "@/components/EditExpenseForm";

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
  unclaimedSplitType?: "equal" | "payer";
  unclaimedMembers?: string[];
}

interface Group {
  _id: string;
  name: string;
  description?: string;
  currency: string;
  members: GroupMember[];
  createdBy: string;
  claimToken: string;
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
  
  // Settle Up Modal State
  const [settleDebt, setSettleDebt] = useState<Debt | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settling, setSettling] = useState(false);

  // Group Edit & Delete Modal States
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupDesc, setEditGroupDesc] = useState("");
  const [editGroupCurrency, setEditGroupCurrency] = useState("");
  const [updatingGroup, setUpdatingGroup] = useState(false);
  const [showDeleteGroupConfirm, setShowDeleteGroupConfirm] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // Group members edit state
  const [editGroupMembers, setEditGroupMembers] = useState<Array<{ id?: string; name: string; email?: string; isGuest: boolean }>>([]);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");

  const handleAddMemberToEditList = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    if (editGroupMembers.some(m => m.name.toLowerCase() === newMemberName.trim().toLowerCase())) {
      alert("A member with this name already exists in the list.");
      return;
    }

    if (newMemberEmail.trim() && editGroupMembers.some(m => m.email && m.email.toLowerCase() === newMemberEmail.trim().toLowerCase())) {
      alert("A member with this email already exists in the list.");
      return;
    }

    const emailVal = newMemberEmail.trim();
    const newMember = {
      name: newMemberName.trim(),
      email: emailVal,
      isGuest: emailVal ? false : true
    };

    setEditGroupMembers([...editGroupMembers, newMember]);
    setNewMemberName("");
    setNewMemberEmail("");
  };

  const handleRemoveMemberFromEditList = (index: number) => {
    const member = editGroupMembers[index];
    if (!window.confirm(`Are you sure you want to remove "${member?.name || "this member"}"?`)) return;
    setEditGroupMembers(editGroupMembers.filter((_, i) => i !== index));
  };

  const handleOpenEditGroup = () => {
    if (group) {
      setEditGroupName(group.name);
      setEditGroupDesc(group.description || "");
      setEditGroupCurrency(group.currency);
      setEditGroupMembers(group.members.map(m => ({
        id: m.id,
        name: m.name,
        email: m.email || "",
        isGuest: m.isGuest
      })));
      setNewMemberName("");
      setNewMemberEmail("");
      setShowEditGroup(true);
    }
  };

  // Expense Edit & Delete States
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState(false);

  // Accordion state
  const [expandedExpenses, setExpandedExpenses] = useState<{ [id: string]: boolean }>({});

  // Group Link Copy notification state
  const [copiedGroupToken, setCopiedGroupToken] = useState<string | null>(null);
  const [copiedExpenseToken, setCopiedExpenseToken] = useState<string | null>(null);

  const handleCopyExpenseClaimLink = (token: string) => {
    const origin = window.location.origin;
    const url = `${origin}/claim/${token}`;
    copyToClipboard(url);
    setCopiedExpenseToken(token);
    setTimeout(() => setCopiedExpenseToken(null), 2000);
  };

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
      
      // Prefill edit values
      setEditGroupName(data.group.name);
      setEditGroupDesc(data.group.description || "");
      setEditGroupCurrency(data.group.currency);
      setEditGroupMembers(data.group.members.map((m: any) => ({
        id: m.id,
        name: m.name,
        email: m.email || "",
        isGuest: m.isGuest
      })));

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

  const handleCopyGroupClaimLink = (token: string) => {
    const origin = window.location.origin;
    const url = `${origin}/claim/group/${token}`;
    copyToClipboard(url);
    setCopiedGroupToken(token);
    setTimeout(() => setCopiedGroupToken(null), 2000);
  };

  const toggleExpenseExpand = (id: string) => {
    setExpandedExpenses(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleEditGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGroupName.trim()) return;

    setUpdatingGroup(true);
    setError("");

    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editGroupName.trim(),
          description: editGroupDesc.trim(),
          currency: editGroupCurrency,
          members: editGroupMembers,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to update group.");
      } else {
        setShowEditGroup(false);
        fetchGroupDetails();
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setUpdatingGroup(false);
    }
  };

  const handleDeleteGroupSubmit = async () => {
    setDeletingGroup(true);
    setError("");

    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to delete group.");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setDeletingGroup(false);
    }
  };

  const handleDeleteExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseToDelete) return;

    setDeletingExpense(true);
    setError("");

    try {
      const res = await fetch(`/api/expenses/${expenseToDelete._id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to delete expense.");
      } else {
        setExpenseToDelete(null);
        fetchGroupDetails();
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setDeletingExpense(false);
    }
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

  const activeUserId = currentGroupMember?.id || currentUserId;
  const myBalance = currentGroupMember ? (balances[currentGroupMember.id] || 0) : 0;
  const isCreator = group.createdBy.toString() === activeUserId;
  const isOneOnOne = group.members.length === 2;
  const friendMember = isOneOnOne
    ? group.members.find((m) => m.id !== activeUserId)
    : null;

  return (
    <>
      <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Link href="/dashboard" className="btn btn-secondary" style={{ width: "auto", padding: "8px 16px" }}>
          <ArrowLeft size={16} />
          Back
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h1 className={styles.title}>{friendMember ? friendMember.name : group.name}</h1>
          {!isOneOnOne && (
            <div style={{ display: "inline-flex", gap: "4px" }}>
              {(isCreator || currentGroupMember) && (
                <button 
                  onClick={handleOpenEditGroup}
                  style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: "4px" }}
                  title="Edit Group Details"
                >
                  <Edit2 size={16} />
                </button>
              )}
              {isCreator && (
                <button 
                  onClick={() => setShowDeleteGroupConfirm(true)}
                  style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", padding: "4px" }}
                  title="Delete Group"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {!isOneOnOne && (
            <>
              <Link
                href={`/claim/group/${group.claimToken}`}
                target="_blank"
                className="btn btn-primary"
                style={{ width: "auto", padding: "8px 16px", display: "flex", gap: "6px", alignItems: "center", textDecoration: "none" }}
                title="Open Public Group Claim Page"
              >
                <span>Open Claims</span>
              </Link>
              <button
                onClick={() => handleCopyGroupClaimLink(group.claimToken)}
                className="btn btn-secondary"
                style={{ width: "auto", padding: "8px 16px", display: "flex", gap: "6px", alignItems: "center" }}
                title="Copy Public Group Claim Link"
              >
                {copiedGroupToken ? (
                  <>
                    <CheckCircle size={16} className="text-success" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 size={16} />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </>
          )}
          
          <button
            onClick={() => fetchGroupDetails()}
            className="btn btn-secondary"
            style={{ width: "auto", padding: "8px 16px" }}
            title="Refresh Balances"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {isOneOnOne ? (
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "-10px", textAlign: "center" }}>
          Direct 1-on-1 Splits
        </p>
      ) : group.description ? (
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "-10px", textAlign: "center" }}>
          {group.description}
        </p>
      ) : null}

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
          {!isOneOnOne && (
            <div className={styles.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h2 className={styles.sectionTitle} style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <Users size={18} />
                  Member Balances
                </h2>
                {(isCreator || currentGroupMember) && (
                  <button 
                    onClick={handleOpenEditGroup}
                    className="btn btn-secondary"
                    style={{ width: "auto", padding: "4px 8px", fontSize: "12px", height: "28px", display: "flex", alignItems: "center", gap: "4px" }}
                    title="Manage Group Members"
                  >
                    <Edit2 size={12} />
                    <span>Manage</span>
                  </button>
                )}
              </div>
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
          )}

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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
                <Calendar size={18} />
                Expenses History
              </h2>
              {expenses.length > 0 && (
                <Link
                  href={`/groups/${groupId}/report`}
                  className="btn btn-secondary"
                  style={{ width: "auto", padding: "6px 12px", fontSize: "12px", display: "flex", gap: "6px", alignItems: "center" }}
                >
                  <FileText size={14} />
                  Export Report
                </Link>
              )}
            </div>
            
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
                  const isExpanded = !!expandedExpenses[exp._id];
                  
                  const expCreator = group.createdBy.toString() === activeUserId;
                  const expPayer = exp.payerId === activeUserId;
                  const canManageExpense = expCreator || expPayer;
                  
                  return (
                    <div 
                      key={exp._id} 
                      className={`${styles.expenseCard} ${isExpanded ? styles.expenseCardExpanded : ""}`}
                      onClick={() => toggleExpenseExpand(exp._id)}
                      style={{ cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div className={styles.expenseMeta}>
                          <span className={styles.expenseDesc}>
                            {exp.description}
                          </span>
                          <span className={styles.expenseSub}>
                            Paid by {payerName} &bull; {new Date(exp.date).toLocaleDateString()}
                          </span>
                          
                          {/* Claim progress indicator inside expense card */}
                          {exp.splitType === "itemized" && (() => {
                            const total = group.members.length;
                            const submitted = exp.submittedMembers || [];
                            const subCount = group.members.filter((m) => submitted.includes(m.id)).length;
                            const remCount = Math.max(0, total - subCount);
                            
                            return (
                              <div style={{ marginTop: "6px", display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <span style={{
                                  fontSize: "10px",
                                  fontWeight: "600",
                                  padding: "2px 6px",
                                  borderRadius: "10px",
                                  backgroundColor: remCount === 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.05)",
                                  color: remCount === 0 ? "var(--accent)" : "var(--text-secondary)",
                                  border: `1px solid ${remCount === 0 ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.08)"}`
                                }}>
                                  {remCount === 0 ? (
                                    "🎉 All Claimed"
                                  ) : (
                                    `${subCount}/${total} Claimed`
                                  )}
                                </span>
                                {exp.claimToken && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation(); // Stop click from bubbling and expanding the row!
                                      handleCopyExpenseClaimLink(exp.claimToken!);
                                    }}
                                    className="btn btn-secondary"
                                    style={{
                                      width: "auto",
                                      padding: "2px 8px",
                                      fontSize: "10px",
                                      height: "20px",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      background: "rgba(99, 102, 241, 0.08)",
                                      border: "1px solid rgba(99, 102, 241, 0.2)",
                                      color: "#a5b4fc",
                                      borderRadius: "6px"
                                    }}
                                    title="Copy Claim Link"
                                  >
                                    {copiedExpenseToken === exp.claimToken ? (
                                      <>
                                        <CheckCircle size={10} className="text-success" />
                                        <span>Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Share2 size={10} />
                                        <span>Share Link</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
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
                          <div>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>
                      </div>

                      {/* Expandable splits/claims content */}
                      {isExpanded && (
                        <div 
                          onClick={(e) => e.stopPropagation()} // prevent collapsing when clicking internal controls
                          style={{
                            marginTop: "16px",
                            paddingTop: "16px",
                            borderTop: "1px dashed rgba(255, 255, 255, 0.08)",
                            cursor: "default"
                          }}
                        >
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: "24px",
                            marginBottom: "12px"
                          }}>
                            {/* Column 1: Items Breakdown */}
                            {exp.splitType === "itemized" && exp.items && exp.items.length > 0 ? (
                              <div>
                                <strong style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                  Line Items Claim Details
                                </strong>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "250px", overflowY: "auto", paddingRight: "4px" }}>
                                  {exp.items.map((item) => {
                                    const claimants = item.claimedBy || [];
                                    const claimantNames = claimants
                                      .map((cId) => group.members.find((m) => m.id === cId)?.name)
                                      .filter(Boolean);
                                    
                                    return (
                                      <div 
                                        key={item.id}
                                        style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                          background: "rgba(0,0,0,0.15)",
                                          padding: "8px 12px",
                                          borderRadius: "6px",
                                          fontSize: "12px",
                                          border: "1px solid rgba(255,255,255,0.02)"
                                        }}
                                      >
                                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.name}</span>
                                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                            {claimantNames.length === 0 ? (
                                              <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "4px", color: "#f87171", backgroundColor: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.12)" }}>
                                                Unclaimed
                                              </span>
                                            ) : (
                                              claimantNames.map((name, i) => (
                                                <span key={i} style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "4px", color: "var(--accent)", backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.12)" }}>
                                                  {name}
                                                </span>
                                              ))
                                            )}
                                          </div>
                                        </div>
                                        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                                          {formatCurrency(item.price, group.currency)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <strong style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                  Expense Details
                                </strong>
                                <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0, lineHeight: "1.4" }}>
                                  {isSettlement ? "This is a recorded debt settlement transaction." : "This is a standard equal split expense. All group members share this cost equally."}
                                </p>
                              </div>
                            )}

                            {/* Column 2: Splits Allocation & Actions */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                              <div>
                                <strong style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                  Splits Allocation
                                </strong>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px", background: "rgba(0,0,0,0.1)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.02)" }}>
                                  {exp.splits.map((split) => {
                                    const member = group.members.find((m) => m.id === split.memberId);
                                    if (!member || split.amount < 0.01) return null;
                                    
                                    return (
                                      <div 
                                        key={split.memberId}
                                        style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          fontSize: "13px",
                                          padding: "4px 0",
                                          borderBottom: "1px solid rgba(255,255,255,0.02)"
                                        }}
                                      >
                                        <span style={{ color: "var(--text-secondary)" }}>{member.name}</span>
                                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                          {formatCurrency(split.amount, group.currency)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Actions Row inside Column 2 */}
                              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
                                {exp.splitType === "itemized" && exp.claimToken && (
                                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    <Link
                                      href={`/claim/${exp.claimToken}`}
                                      target="_blank"
                                      className="btn btn-secondary"
                                      style={{ flex: 1, minWidth: "120px", padding: "6px 12px", fontSize: "12px", display: "flex", gap: "6px", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                                    >
                                      <FileText size={12} />
                                      <span>Open Claim Page</span>
                                    </Link>
                                    <button
                                      onClick={() => handleCopyExpenseClaimLink(exp.claimToken!)}
                                      className="btn btn-secondary"
                                      style={{ flex: 1, minWidth: "120px", padding: "6px 12px", fontSize: "12px", display: "flex", gap: "6px", alignItems: "center", justifyContent: "center" }}
                                    >
                                      {copiedExpenseToken === exp.claimToken ? (
                                        <>
                                          <CheckCircle size={12} className="text-success" />
                                          <span>Copied!</span>
                                        </>
                                      ) : (
                                        <>
                                          <Share2 size={12} />
                                          <span>Copy Claim Link</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}

                                {canManageExpense && (
                                  <div style={{ display: "flex", gap: "8px", alignSelf: "flex-end", marginTop: "4px" }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpenseToEdit(exp);
                                      }}
                                      className="btn btn-secondary"
                                      style={{ width: "auto", padding: "6px 12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}
                                    >
                                      <Edit2 size={12} /> Edit
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpenseToDelete(exp);
                                      }}
                                      className="btn btn-danger"
                                      style={{ width: "auto", padding: "6px 12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}
                                    >
                                      <Trash2 size={12} /> Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Moved Floating Add Button below the container to avoid transform/containing block clipping */}

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
                  step="any"
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

      {/* Edit Group Modal */}
      {showEditGroup && (
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
          <div className={styles.card} style={{ width: "100%", maxWidth: "450px", background: "#131325", maxHeight: "calc(100vh - 40px)", overflowY: "auto" }}>
            <h2 className={styles.sectionTitle}>Edit Group Details</h2>
            <form onSubmit={handleEditGroupSubmit} className="form" style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="input-group">
                <label>Group Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label>Description</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Trip to Manali, Room sharing"
                  value={editGroupDesc}
                  onChange={(e) => setEditGroupDesc(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>Currency</label>
                <select
                  className="input-field"
                  value={editGroupCurrency}
                  onChange={(e) => setEditGroupCurrency(e.target.value)}
                  style={{ backgroundColor: "rgba(0,0,0,0.2)" }}
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid var(--card-border)", margin: "16px 0" }} />
              
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>
                Group Members ({editGroupMembers.length})
              </h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "150px", overflowY: "auto", marginBottom: "12px", paddingRight: "4px" }}>
                {editGroupMembers.map((member, index) => {
                  const isUserCreator = group && member.id === group.createdBy;
                  return (
                    <div 
                      key={index} 
                      style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center", 
                        background: "rgba(255,255,255,0.02)", 
                        padding: "6px 8px", 
                        borderRadius: "6px",
                        border: "1px solid var(--card-border)",
                        fontSize: "12px"
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{member.name}</span>
                        {member.email && <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{member.email}</span>}
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ 
                          fontSize: "10px", 
                          padding: "2px 6px", 
                          borderRadius: "4px", 
                          background: member.isGuest ? "rgba(255, 255, 255, 0.05)" : "rgba(99, 102, 241, 0.15)",
                          color: member.isGuest ? "var(--text-secondary)" : "var(--primary)"
                        }}>
                          {member.isGuest ? "Guest" : "User"}
                        </span>
                        
                        {!isUserCreator && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMemberFromEditList(index)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#f87171",
                              cursor: "pointer",
                              padding: "4px",
                              display: "flex",
                              alignItems: "center"
                            }}
                            title="Remove member"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div 
                style={{ 
                  background: "rgba(255, 255, 255, 0.01)", 
                  border: "1px dashed var(--card-border)", 
                  borderRadius: "8px", 
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>Add New Friend</span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    type="text"
                    placeholder="Name"
                    className="input-field"
                    style={{ flex: 1, padding: "6px", fontSize: "12px", height: "30px", background: "rgba(0,0,0,0.2)" }}
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    className="input-field"
                    style={{ flex: 1, padding: "6px", fontSize: "12px", height: "30px", background: "rgba(0,0,0,0.2)" }}
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddMemberToEditList}
                  className="btn btn-secondary"
                  style={{ padding: "6px", fontSize: "11px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                >
                  <Plus size={12} /> Add to List
                </button>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                <button 
                  type="button" 
                  onClick={() => setShowEditGroup(false)} 
                  className="btn btn-secondary"
                  disabled={updatingGroup}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={updatingGroup}
                >
                  {updatingGroup ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Group Confirm Modal */}
      {showDeleteGroupConfirm && (
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
            <h2 className={styles.sectionTitle} style={{ color: "#f87171" }}>Delete Group?</h2>
            <div style={{ marginTop: "12px", fontSize: "14px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "10px" }}>
              <p>Are you sure you want to delete <strong>{group.name}</strong>?</p>
              <p style={{ color: "#f87171", fontWeight: 600 }}>WARNING: This action is permanent. All expenses, item scans, and settlement history in this group will be deleted forever.</p>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button 
                type="button" 
                onClick={() => setShowDeleteGroupConfirm(false)} 
                className="btn btn-secondary"
                disabled={deletingGroup}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteGroupSubmit} 
                className="btn btn-danger"
                disabled={deletingGroup}
              >
                {deletingGroup ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Expense Confirm Modal */}
      {expenseToDelete && (
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
            <h2 className={styles.sectionTitle} style={{ color: "#f87171" }}>Delete Expense?</h2>
            <div style={{ marginTop: "12px", fontSize: "14px", color: "var(--text-secondary)" }}>
              <p>Are you sure you want to delete the expense <strong>{expenseToDelete.description}</strong> for <strong>{formatCurrency(expenseToDelete.amount, group.currency)}</strong>?</p>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button 
                type="button" 
                onClick={() => setExpenseToDelete(null)} 
                className="btn btn-secondary"
                disabled={deletingExpense}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteExpenseSubmit} 
                className="btn btn-danger"
                disabled={deletingExpense}
              >
                {deletingExpense ? "Deleting..." : "Delete Expense"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Expense Drawer */}
      {expenseToEdit && (
        <EditExpenseForm
          group={group}
          expense={expenseToEdit}
          onClose={() => setExpenseToEdit(null)}
          onSuccess={() => {
            setExpenseToEdit(null);
            fetchGroupDetails();
          }}
        />
      )}

      {/* Floating Add Button */}
      <Link 
        href={`/groups/${groupId}/add-expense`}
        className={styles.floatingAddBtn}
        aria-label="Add expense"
        style={{ pointerEvents: "auto", zIndex: 60 }}
      >
        <Plus size={24} />
      </Link>
    </>
  );
}
