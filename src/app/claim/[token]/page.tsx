"use client";

import { useState, useEffect, use } from "react";
import styles from "@/styles/Claim.module.css";
import { Check, AlertTriangle, Printer, Users, Receipt, Smile } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

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
}

interface Group {
  _id: string;
  name: string;
  currency: string;
  members: GroupMember[];
}

export default function PublicClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [expense, setExpense] = useState<Expense | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Selection states
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  
  // Submission states
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Local cache of claims to calculate prices dynamically
  const [claimsCache, setClaimsCache] = useState<{ [itemId: string]: string[] }>({});

  const fetchClaimData = async () => {
    try {
      const res = await fetch(`/api/claims/${token}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Claim link not found or expired.");
        } else {
          setError("Failed to load claim details.");
        }
        return;
      }
      const data = await res.json();
      setExpense(data.expense);
      setGroup(data.group);
      
      // Initialize claims cache
      const cache: { [itemId: string]: string[] } = {};
      data.expense.items.forEach((item: ExpenseItem) => {
        cache[item.id] = item.claimedBy || [];
      });
      setClaimsCache(cache);
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
    if (!expense) return;

    const memberClaims: string[] = [];
    expense.items.forEach((item) => {
      if (item.claimedBy && item.claimedBy.includes(memberId)) {
        memberClaims.push(item.id);
      }
    });
    setSelectedItemIds(memberClaims);

    // Reset cache to original values, but ensure this member is checked where they should be
    const freshCache: { [itemId: string]: string[] } = {};
    expense.items.forEach((item) => {
      // Get all claimants except this member
      const otherClaimants = (item.claimedBy || []).filter((id) => id !== memberId);
      // If member claims it now, add them
      if (item.claimedBy && item.claimedBy.includes(memberId)) {
        freshCache[item.id] = [...otherClaimants, memberId];
      } else {
        freshCache[item.id] = otherClaimants;
      }
    });
    setClaimsCache(freshCache);
  };

  const handleToggleItem = (itemId: string) => {
    if (!selectedMemberId) return;

    const isCurrentlySelected = selectedItemIds.includes(itemId);
    let newSelection = [];

    if (isCurrentlySelected) {
      newSelection = selectedItemIds.filter((id) => id !== itemId);
    } else {
      newSelection = [...selectedItemIds, itemId];
    }

    setSelectedItemIds(newSelection);

    // Update live claims cache
    const currentClaimants = claimsCache[itemId] || [];
    let updatedClaimants = [];

    if (isCurrentlySelected) {
      // Remove self
      updatedClaimants = currentClaimants.filter((id) => id !== selectedMemberId);
    } else {
      // Add self
      updatedClaimants = currentClaimants.includes(selectedMemberId)
        ? currentClaimants
        : [...currentClaimants, selectedMemberId];
    }

    setClaimsCache({
      ...claimsCache,
      [itemId]: updatedClaimants,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/claims/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          memberId: selectedMemberId,
          itemIds: selectedItemIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to submit claim.");
      } else {
        setSubmitted(true);
        // Refresh claim details to get updated state for printout
        const data = await res.json();
        setExpense(data.expense);
        setGroup(data.group);
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
        <p style={{ color: "var(--text-secondary)" }}>Loading bill details...</p>
      </div>
    );
  }

  if (error || !expense || !group) {
    return (
      <div className={styles.container} style={{ maxWidth: "480px", margin: "0 auto", padding: "16px" }}>
        <div className="btn btn-danger" style={{ cursor: "default", opacity: 0.9, marginTop: "40px" }}>
          <AlertTriangle size={18} style={{ display: "inline-block", marginRight: "6px", verticalAlign: "middle" }} />
          {error || "Receipt details not found."}
        </div>
      </div>
    );
  }

  const selectedMember = group.members.find((m) => m.id === selectedMemberId);

  // Calculate receipt summary items
  const summaryReceiptItems = selectedItemIds.map((itemId) => {
    const item = expense.items.find((i) => i.id === itemId);
    if (!item) return null;

    const claimantsCount = Math.max(claimsCache[itemId]?.length || 1, 1);
    const yourSharePrice = item.price / claimantsCount;

    return {
      id: item.id,
      name: item.name,
      fullPrice: item.price,
      claimantsCount,
      sharePrice: yourSharePrice,
    };
  }).filter(Boolean) as Array<{ id: string; name: string; fullPrice: number; claimantsCount: number; sharePrice: number }>;

  const yourTotalShare = summaryReceiptItems.reduce((sum, item) => sum + item.sharePrice, 0);

  return (
    <div className={styles.container} style={{ maxWidth: "480px", margin: "0 auto", padding: "16px", paddingBottom: "48px" }}>
      
      {!submitted ? (
        <div className={styles.card}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
            <Receipt size={36} style={{ color: "var(--primary)" }} />
          </div>
          
          <h1 className={styles.title}>Claim Your Items</h1>
          <p className={styles.subtitle}>
            Select your name and check the items you consumed from **{expense.description}**.
          </p>

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
                <span className={styles.pickerLabel}>Items on Bill</span>
                <div className={styles.itemList}>
                  {expense.items.map((item) => {
                    const isChecked = selectedItemIds.includes(item.id);
                    const claimants = claimsCache[item.id] || [];
                    const otherClaimants = claimants
                      .filter((id) => id !== selectedMemberId)
                      .map((id) => group.members.find((m) => m.id === id)?.name)
                      .filter(Boolean);

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggleItem(item.id)}
                        className={`${styles.itemCard} ${isChecked ? styles.itemCardActive : ""}`}
                      >
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={isChecked}
                          onChange={() => {}} // toggled by parent div click
                        />
                        <div className={styles.itemInfo}>
                          <span className={styles.itemName}>{item.name}</span>
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
                        <span className={styles.itemPrice}>
                          {formatCurrency(item.price, group.currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {summaryReceiptItems.length > 0 && (
                  <div className={styles.summaryReceipt}>
                    <h3 className={styles.receiptTitle}>Live Receipt Summary</h3>
                    {summaryReceiptItems.map((item) => (
                      <div key={item.id} className={styles.receiptItem}>
                        <span>
                          {item.name} 
                          {item.claimantsCount > 1 && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "4px" }}>
                              (Split {item.claimantsCount} ways)
                            </span>
                          )}
                        </span>
                        <span>{formatCurrency(item.sharePrice, group.currency)}</span>
                      </div>
                    ))}
                    <div className={styles.receiptTotalRow}>
                      <span>Your Share:</span>
                      <span>{formatCurrency(yourTotalShare, group.currency)}</span>
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
                  {submitting ? "Submitting claims..." : "Submit Claims"}
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
            Thank you, <strong>{selectedMember?.name}</strong>! Your items have been logged. The group host can see your balances in real time.
          </p>

          <div className={styles.receiptPrintout}>
            <div className={styles.receiptPrintHeader}>
              <strong style={{ fontSize: "14px", textTransform: "uppercase" }}>{group.name}</strong>
              <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "4px" }}>
                RECEIPT FOR: {selectedMember?.name?.toUpperCase()}
              </div>
            </div>
            
            <div className={styles.receiptPrintBody}>
              {expense.items
                .filter((item) => item.claimedBy && item.claimedBy.includes(selectedMemberId))
                .map((item) => {
                  const claimantsCount = item.claimedBy.length;
                  const price = item.price / claimantsCount;
                  
                  return (
                    <div key={item.id} className={styles.receiptPrintLine}>
                      <span>
                        {item.name.substring(0, 18)}
                        {claimantsCount > 1 ? ` (1/${claimantsCount})` : ""}
                      </span>
                      <span>{formatCurrency(price, group.currency)}</span>
                    </div>
                  );
                })}
              
              <div className={styles.receiptPrintTotal}>
                <span>TOTAL SHARE:</span>
                <span>{formatCurrency(yourTotalShare, group.currency)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setSubmitted(false)}
            className="btn btn-secondary"
            style={{ marginTop: "12px" }}
          >
            Edit Claims
          </button>
        </div>
      )}
    </div>
  );
}
