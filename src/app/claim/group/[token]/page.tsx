"use client";

import { useState, useEffect, use } from "react";
import styles from "@/styles/Claim.module.css";
import { Check, AlertTriangle, Receipt, Smile, ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface GroupMember {
  id: string;
  name: string;
  isGuest: boolean;
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
  splitType: string;
  items: ExpenseItem[];
  unclaimedSplitType: "equal" | "payer";
  currency: string;
  submittedMembers?: string[];
  unclaimedMembers?: string[];
}

interface Group {
  _id: string;
  name: string;
  currency: string;
  members: GroupMember[];
  createdBy: string;
}

export default function PublicGroupClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { data: session } = useSession();

  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Selection states
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedClaims, setSelectedClaims] = useState<{ [expenseId: string]: string[] }>({}); // expenseId -> itemId[]
  
  // Submission states
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Expanded states for expenses accordion
  const [expandedExpenses, setExpandedExpenses] = useState<{ [expenseId: string]: boolean }>({});
  
  // Local cache of claims to calculate prices dynamically: expenseId -> itemId -> claimantsList
  const [claimsCache, setClaimsCache] = useState<{ [expenseId: string]: { [itemId: string]: string[] } }>({});

  const fetchClaimData = async () => {
    try {
      const res = await fetch(`/api/claims/group/${token}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Claim link not found or expired.");
        } else {
          setError("Failed to load claim details.");
        }
        return;
      }
      const data = await res.json();
      setGroup(data.group);
      setExpenses(data.expenses);
      
      // Initialize claims cache and accordion expansion (expand first by default if any)
      const cache: typeof claimsCache = {};
      const initialExpanded: typeof expandedExpenses = {};
      
      data.expenses.forEach((expense: Expense, idx: number) => {
        cache[expense._id] = {};
        expense.items.forEach((item: ExpenseItem) => {
          cache[expense._id][item.id] = item.claimedBy || [];
        });
        initialExpanded[expense._id] = idx === 0; // expand first expense
      });
      
      setClaimsCache(cache);
      setExpandedExpenses(initialExpanded);
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaimData();
  }, [token]);

  // When selected member changes, load their existing claims
  const handleMemberChange = (memberId: string) => {
    setSelectedMemberId(memberId);
    if (expenses.length === 0) return;

    const initialClaims: { [expenseId: string]: string[] } = {};
    const freshCache: typeof claimsCache = {};

    expenses.forEach((expense) => {
      const memberClaims: string[] = [];
      freshCache[expense._id] = {};

      expense.items.forEach((item) => {
        // Track checked items for this member
        if (item.claimedBy && item.claimedBy.includes(memberId)) {
          memberClaims.push(item.id);
        }

        // Initialize cache with this member's current database state
        const otherClaimants = (item.claimedBy || []).filter((id) => id !== memberId);
        if (item.claimedBy && item.claimedBy.includes(memberId)) {
          freshCache[expense._id][item.id] = [...otherClaimants, memberId];
        } else {
          freshCache[expense._id][item.id] = otherClaimants;
        }
      });

      initialClaims[expense._id] = memberClaims;
    });

    setSelectedClaims(initialClaims);
    setClaimsCache(freshCache);
  };

  const handleToggleItem = (expenseId: string, itemId: string) => {
    if (!selectedMemberId) return;

    const currentExpenseClaims = selectedClaims[expenseId] || [];
    const isCurrentlySelected = currentExpenseClaims.includes(itemId);
    let updatedExpenseClaims = [];

    if (isCurrentlySelected) {
      updatedExpenseClaims = currentExpenseClaims.filter((id) => id !== itemId);
    } else {
      updatedExpenseClaims = [...currentExpenseClaims, itemId];
    }

    setSelectedClaims({
      ...selectedClaims,
      [expenseId]: updatedExpenseClaims,
    });

    // Update live claims cache
    const currentClaimants = claimsCache[expenseId]?.[itemId] || [];
    let updatedClaimants = [];

    if (isCurrentlySelected) {
      updatedClaimants = currentClaimants.filter((id) => id !== selectedMemberId);
    } else {
      updatedClaimants = currentClaimants.includes(selectedMemberId)
        ? currentClaimants
        : [...currentClaimants, selectedMemberId];
    }

    setClaimsCache({
      ...claimsCache,
      [expenseId]: {
        ...claimsCache[expenseId],
        [itemId]: updatedClaimants,
      },
    });
  };

  const toggleExpand = (expenseId: string) => {
    setExpandedExpenses({
      ...expandedExpenses,
      [expenseId]: !expandedExpenses[expenseId],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/claims/group/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId: selectedMemberId,
          claims: selectedClaims,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to submit claims.");
      } else {
        setSubmitted(true);
        // Refresh claim details to get updated state
        const data = await res.json();
        setExpenses(data.expenses);
        setGroup(data.group);

        const cache: typeof claimsCache = {};
        data.expenses.forEach((expense: Expense) => {
          cache[expense._id] = {};
          expense.items.forEach((item: ExpenseItem) => {
            cache[expense._id][item.id] = item.claimedBy || [];
          });
        });
        setClaimsCache(cache);
      }
    } catch (err) {
      setError("An unexpected error occurred during submission.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading group bill details...</p>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className={styles.container} style={{ maxWidth: "480px", margin: "0 auto", padding: "16px" }}>
        <div className="btn btn-danger" style={{ cursor: "default", opacity: 0.9, marginTop: "40px" }}>
          <AlertTriangle size={18} style={{ display: "inline-block", marginRight: "6px", verticalAlign: "middle" }} />
          {error || "Group details not found."}
        </div>
      </div>
    );
  }

  const selectedMember = group.members.find((m) => m.id === selectedMemberId);

  // Group-wide calculations for the selected member
  let groupTotalShare = 0;
  const expenseBreakdown: Array<{
    expenseId: string;
    description: string;
    itemsShare: number;
    differenceShare: number;
    totalShare: number;
    currency: string;
    itemDetails: Array<{ name: string; sharePrice: number; splitWays: number }>;
  }> = [];

  expenses.forEach((expense) => {
    const checkedItemIds = selectedClaims[expense._id] || [];
    const totalItemsSum = expense.items.reduce((sum, item) => sum + item.price, 0);
    const scaleRatio = totalItemsSum > 0.01 ? expense.amount / totalItemsSum : 1;

    // Calculate this member's exact pre-tax share based on the claims cache
    const preTaxShares: { [memberId: string]: number } = {};
    group.members.forEach((m) => { preTaxShares[m.id] = 0; });

    expense.items.forEach((item) => {
      const claimants = claimsCache[expense._id]?.[item.id] || [];
      if (claimants.length > 0) {
        const share = item.price / claimants.length;
        claimants.forEach((cId) => {
          if (preTaxShares[cId] !== undefined) {
            preTaxShares[cId] += share;
          }
        });
      } else {
        if (expense.unclaimedSplitType === "payer") {
          if (preTaxShares[expense.payerId] !== undefined) {
            preTaxShares[expense.payerId] += item.price;
          }
        } else {
          const share = item.price / group.members.length;
          group.members.forEach((m) => {
            if (preTaxShares[m.id] !== undefined) {
              preTaxShares[m.id] += share;
            }
          });
        }
      }
    });

    const memberPreTaxShare = preTaxShares[selectedMemberId] || 0;
    const finalTotalShareForThisExpense = totalItemsSum > 0.01 
      ? (memberPreTaxShare / totalItemsSum) * expense.amount 
      : expense.amount / group.members.length;

    // Calculate user's checked items share (scaled proportionally)
    let itemsShare = 0;
    const itemDetails: Array<{ name: string; sharePrice: number; splitWays: number }> = [];

    checkedItemIds.forEach((itemId) => {
      const item = expense.items.find((i) => i.id === itemId);
      if (!item) return;

      const claimantsCount = Math.max(claimsCache[expense._id]?.[itemId]?.length || 1, 1);
      const sharePrice = (item.price / claimantsCount) * scaleRatio;
      itemsShare += sharePrice;
      
      itemDetails.push({
        name: item.name,
        sharePrice,
        splitWays: claimantsCount
      });
    });

    // Difference share represents tax/fee/discount and unclaimed items split equally
    const differenceShare = finalTotalShareForThisExpense - itemsShare;

    groupTotalShare += finalTotalShareForThisExpense;

    expenseBreakdown.push({
      expenseId: expense._id,
      description: expense.description,
      itemsShare,
      differenceShare,
      totalShare: finalTotalShareForThisExpense,
      currency: group.currency,
      itemDetails
    });
  });

  // Calculate overall progress across group
  const totalExpensesCount = expenses.length;
  
  // Host verification
  const isHost = session?.user && (
    expenses.some((exp) => (session.user as any).id === exp.payerId) ||
    (session.user as any).id === group.createdBy
  );

  return (
    <div className={styles.container} style={{ maxWidth: "480px", margin: "0 auto", padding: "16px", paddingBottom: "48px" }}>
      
      {!submitted ? (
        <div className={styles.card}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
            <Receipt size={36} style={{ color: "var(--primary)" }} />
          </div>
          
          <h1 className={styles.title}>{group.name}</h1>
          <p className={styles.subtitle}>
            Select your name and claim the items you consumed across all group bills.
          </p>

          {/* Group Info Indicator */}
          <div style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            borderRadius: "10px",
            padding: "12px",
            marginBottom: "16px",
            fontSize: "13px",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-secondary)", fontWeight: "500" }}>Total Itemized Bills</span>
              <span style={{ color: "var(--primary)", fontWeight: "600" }}>
                {totalExpensesCount} Bills Available
              </span>
            </div>
          </div>

          {/* Host Admin Mode Banner */}
          {isHost && (
            <div style={{
              background: "rgba(99, 102, 241, 0.1)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              borderRadius: "10px",
              padding: "12px",
              marginBottom: "16px",
              fontSize: "13px",
              display: "flex",
              gap: "10px",
              alignItems: "flex-start"
            }}>
              <ShieldAlert size={18} style={{ color: "var(--primary)", flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "2px" }}>
                  👑 Host Admin Mode Active
                </strong>
                <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
                  As a host/payer, you can select any member and edit their claims to correct mistakes.
                </span>
              </div>
            </div>
          )}

          {error && <div className="btn btn-danger" style={{ cursor: "default", padding: "10px", fontSize: "13px" }}>{error}</div>}

          <form onSubmit={handleSubmit} className="form" style={{ marginTop: "16px" }}>
            <div className={styles.pickerGroup}>
              <label className={styles.pickerLabel} htmlFor="memberDropdown">Who are you?</label>
              <select
                id="memberDropdown"
                className={styles.pickerSelect}
                value={selectedMemberId}
                onChange={(e) => handleMemberChange(e.target.value)}
                required
              >
                <option value="">-- Choose your name --</option>
                {group.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} {member.isGuest ? "(Guest)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedMemberId && (
              <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <span className={styles.pickerLabel} style={{ marginBottom: "-4px" }}>Itemized Bills Checklist</span>
                
                {expenses.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", padding: "12px", textAlign: "center" }}>
                    No itemized expenses found in this group yet.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {expenses.map((expense) => {
                      const isExpanded = !!expandedExpenses[expense._id];
                      const checkedItemsCount = selectedClaims[expense._id]?.length || 0;
                      
                      return (
                        <div 
                          key={expense._id}
                          style={{
                            background: "rgba(255, 255, 255, 0.02)",
                            border: "1px solid var(--card-border)",
                            borderRadius: "10px",
                            overflow: "hidden"
                          }}
                        >
                          {/* Accordion Header */}
                          <div 
                            onClick={() => toggleExpand(expense._id)}
                            style={{
                              padding: "14px 16px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              cursor: "pointer",
                              background: isExpanded ? "rgba(255, 255, 255, 0.04)" : "transparent",
                              borderBottom: isExpanded ? "1px solid var(--card-border)" : "none",
                              transition: "background 0.2s"
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>{expense.description}</strong>
                              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                Total: {formatCurrency(expense.amount, group.currency)} &bull; {checkedItemsCount} items claimed
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              {checkedItemsCount > 0 && (
                                <span style={{
                                  fontSize: "11px",
                                  background: "rgba(16, 185, 129, 0.15)",
                                  color: "var(--accent)",
                                  padding: "2px 8px",
                                  borderRadius: "12px",
                                  fontWeight: 600
                                }}>
                                  Claimed
                                </span>
                              )}
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </div>

                          {/* Accordion Content */}
                          {isExpanded && (
                            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                              {expense.items.map((item) => {
                                const isChecked = (selectedClaims[expense._id] || []).includes(item.id);
                                const claimants = claimsCache[expense._id]?.[item.id] || [];
                                const otherClaimants = claimants
                                  .filter((id) => id !== selectedMemberId)
                                  .map((id) => group.members.find((m) => m.id === id)?.name)
                                  .filter(Boolean);

                                return (
                                  <div
                                    key={item.id}
                                    onClick={() => handleToggleItem(expense._id, item.id)}
                                    className={`${styles.itemCard} ${isChecked ? styles.itemCardActive : ""}`}
                                    style={{ padding: "12px 14px" }}
                                  >
                                    <input
                                      type="checkbox"
                                      className={styles.checkbox}
                                      checked={isChecked}
                                      onChange={() => {}} // toggled by click handler on parent div
                                    />
                                    <div className={styles.itemInfo}>
                                      <span className={styles.itemName} style={{ fontSize: "14px" }}>{item.name}</span>
                                      <div className={styles.claimants}>
                                        {isChecked && (
                                          <span className={`${styles.claimantBadge} ${styles.claimantBadgeSelf}`}>
                                            You
                                          </span>
                                        )}
                                        {otherClaimants.map((name, i) => (
                                          <span key={i} className={styles.claimantBadge}>
                                            {name}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    <span className={styles.itemPrice} style={{ fontSize: "14px" }}>
                                      {formatCurrency(item.price, group.currency)}
                                    </span>
                                  </div>
                                );
                              })}

                              {/* Tax/Fees details for this expense */}
                              {(() => {
                                const totalItemsSum = expense.items.reduce((sum, item) => sum + item.price, 0);
                                const netDifference = expense.amount - totalItemsSum;
                                
                                if (Math.abs(netDifference) > 0.01) {
                                  return (
                                    <div style={{
                                      fontSize: "11px",
                                      color: "var(--text-secondary)",
                                      background: "rgba(255, 255, 255, 0.02)",
                                      borderRadius: "6px",
                                      padding: "8px 10px",
                                      marginTop: "4px"
                                    }}>
                                      {netDifference > 0 ? (
                                        <>This bill includes <strong>{formatCurrency(netDifference, group.currency)}</strong> in additional fees (taxes, GST, etc.) split proportionally.</>
                                      ) : (
                                        <>This bill includes a global discount of <strong>{formatCurrency(Math.abs(netDifference), group.currency)}</strong> split proportionally.</>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Live Receipt Summary across Group */}
                {groupTotalShare > 0 && (
                  <div className={styles.summaryReceipt}>
                    <h3 className={styles.receiptTitle}>Consolidated Receipt Summary</h3>
                    
                    {expenseBreakdown
                      .filter((exp) => exp.itemDetails.length > 0 || Math.abs(exp.differenceShare) > 0.01)
                      .map((exp) => (
                        <div 
                          key={exp.expenseId}
                          style={{
                            borderBottom: "1px solid rgba(16, 185, 129, 0.1)",
                            paddingBottom: "8px",
                            marginBottom: "8px"
                          }}
                        >
                          <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>
                            {exp.description}
                          </div>
                          
                          {exp.itemDetails.map((item, i) => (
                            <div key={i} className={styles.receiptItem} style={{ fontSize: "12px", paddingLeft: "8px" }}>
                              <span>
                                {item.name} 
                                {item.splitWays > 1 && ` (Split ${item.splitWays} ways)`}
                              </span>
                              <span>{formatCurrency(item.sharePrice, group.currency)}</span>
                            </div>
                          ))}

                          {Math.abs(exp.differenceShare) > 0.01 && (
                            <div className={styles.receiptItem} style={{ fontSize: "12px", paddingLeft: "8px", color: "var(--text-muted)" }}>
                              <span>{exp.differenceShare > 0 ? "Taxes & Fees Share" : "Discount Share"}</span>
                              <span>{formatCurrency(exp.differenceShare, group.currency)}</span>
                            </div>
                          )}
                          
                          <div className={styles.receiptItem} style={{ fontSize: "12px", fontWeight: "600", color: "var(--accent)", paddingLeft: "8px", marginTop: "4px" }}>
                            <span>Bill Subtotal:</span>
                            <span>{formatCurrency(exp.totalShare, group.currency)}</span>
                          </div>
                        </div>
                      ))}

                    <div className={styles.receiptTotalRow}>
                      <span>Grand Total Share:</span>
                      <span>{formatCurrency(groupTotalShare, group.currency)}</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ marginTop: "12px" }}
                  disabled={submitting}
                >
                  <Check size={18} />
                  {submitting ? "Submitting claims..." : "Submit All Claims"}
                </button>
              </div>
            )}
          </form>
        </div>
      ) : (
        <div className={`${styles.card} ${styles.successScreen}`}>
          <div className={styles.successIcon}>
            <Smile size={36} />
          </div>
          <h2 className={styles.title}>Claims Submitted!</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Thank you, <strong>{selectedMember?.name}</strong>! Your claims have been updated. The group host can see your balances in real time.
          </p>

          <div className={styles.receiptPrintout}>
            <div className={styles.receiptPrintHeader}>
              <strong style={{ fontSize: "14px", textTransform: "uppercase" }}>{group.name}</strong>
              <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "4px" }}>
                CONSOLIDATED RECEIPT FOR: {selectedMember?.name?.toUpperCase()}
              </div>
            </div>
            
            <div className={styles.receiptPrintBody}>
              {expenseBreakdown
                .filter((exp) => exp.totalShare > 0.01)
                .map((exp) => (
                  <div key={exp.expenseId} style={{ borderBottom: "1px dashed rgba(255,255,255,0.05)", paddingBottom: "6px", marginBottom: "6px" }}>
                    <div style={{ fontWeight: "700", fontSize: "11px", color: "var(--primary)", textTransform: "uppercase" }}>
                      {exp.description.substring(0, 24)}
                    </div>
                    {exp.itemDetails.map((item, idx) => (
                      <div key={idx} className={styles.receiptPrintLine} style={{ fontSize: "11px", paddingLeft: "4px" }}>
                        <span>
                          {item.name.substring(0, 16)}
                          {item.splitWays > 1 ? ` (1/${item.splitWays})` : ""}
                        </span>
                        <span>{formatCurrency(item.sharePrice, group.currency)}</span>
                      </div>
                    ))}
                    {Math.abs(exp.differenceShare) > 0.01 && (
                      <div className={styles.receiptPrintLine} style={{ fontSize: "11px", paddingLeft: "4px", color: "#94a3b8" }}>
                        <span>{exp.differenceShare > 0 ? "TAX & FEES" : "DISCOUNT"}</span>
                        <span>{formatCurrency(exp.differenceShare, group.currency)}</span>
                      </div>
                    )}
                    <div className={styles.receiptPrintLine} style={{ fontSize: "11px", fontWeight: "700", paddingLeft: "4px", marginTop: "2px" }}>
                      <span>Subtotal:</span>
                      <span>{formatCurrency(exp.totalShare, group.currency)}</span>
                    </div>
                  </div>
                ))}
              
              <div className={styles.receiptPrintTotal}>
                <span>TOTAL OWE SHARE:</span>
                <span>{formatCurrency(groupTotalShare, group.currency)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setSubmitted(false)}
            className="btn btn-secondary"
            style={{ marginTop: "12px" }}
          >
            {isHost ? "Manage More Claims" : "Edit Claims"}
          </button>
        </div>
      )}
    </div>
  );
}
