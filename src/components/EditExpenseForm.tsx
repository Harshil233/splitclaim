"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import styles from "@/styles/Expense.module.css";
import { X, Save, Calculator, AlertTriangle, FileText, Check } from "lucide-react";
import BillScanner from "./BillScanner";
import { formatCurrency } from "@/lib/utils";

interface GroupMember {
  id: string;
  name: string;
  email?: string;
  isGuest: boolean;
}

interface Group {
  _id: string;
  name: string;
  currency: string;
  members: GroupMember[];
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
  splitType: "equal" | "unequal" | "percentage" | "itemized";
  splits: ExpenseSplit[];
  items?: ExpenseItem[];
  unclaimedSplitType?: "equal" | "payer";
  unclaimedMembers?: string[];
}

interface EditExpenseFormProps {
  group: Group;
  expense: Expense;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditExpenseForm({ group, expense, onClose, onSuccess }: EditExpenseFormProps) {
  const { data: session } = useSession();
  
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState<number>(expense.amount);
  const [payerId, setPayerId] = useState(expense.payerId);
  const [splitType, setSplitType] = useState<"equal" | "unequal" | "percentage" | "itemized">(expense.splitType);
  
  // Equal Split state
  const [equalChecked, setEqualChecked] = useState<{ [memberId: string]: boolean }>({});
  
  // Unequal Split state
  const [unequalAmounts, setUnequalAmounts] = useState<{ [memberId: string]: number }>({});
  
  // Percentage Split state
  const [percentageRates, setPercentageRates] = useState<{ [memberId: string]: number }>({});
  
  // Itemized split state
  const [scannedItems, setScannedItems] = useState<Array<{ id: string; name: string; price: number; claimedBy?: string[] }>>([]);
  const [unclaimedSplitType, setUnclaimedSplitType] = useState<"equal" | "payer">(expense.unclaimedSplitType || "equal");
  const [unclaimedMembers, setUnclaimedMembers] = useState<string[]>(expense.unclaimedMembers || []);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Initialize form with existing values
  useEffect(() => {
    // Equal split checked mapping
    const eqChecked: { [memberId: string]: boolean } = {};
    // Prefill unequal amounts
    const uneqAmts: { [memberId: string]: number } = {};
    // Prefill percentage rates
    const pctRates: { [memberId: string]: number } = {};

    group.members.forEach((m) => {
      eqChecked[m.id] = false;
      uneqAmts[m.id] = 0;
      pctRates[m.id] = 0;
    });

    if (expense.splitType === "equal") {
      expense.splits.forEach((s) => {
        if (s.amount > 0.01) {
          eqChecked[s.memberId] = true;
        }
      });
    } else if (expense.splitType === "unequal") {
      expense.splits.forEach((s) => {
        uneqAmts[s.memberId] = s.amount;
      });
    } else if (expense.splitType === "percentage") {
      expense.splits.forEach((s) => {
        pctRates[s.memberId] = parseFloat(((s.amount / expense.amount) * 100).toFixed(1));
      });
    } else if (expense.splitType === "itemized" && expense.items) {
      setScannedItems(expense.items);
    }

    setEqualChecked(eqChecked);
    setUnequalAmounts(uneqAmts);
    setPercentageRates(pctRates);
    setUnclaimedMembers(
      expense.unclaimedMembers && expense.unclaimedMembers.length > 0
        ? expense.unclaimedMembers
        : group.members.map((m) => m.id)
    );
  }, [expense, group]);

  const handleEqualCheckboxChange = (memberId: string) => {
    setEqualChecked({
      ...equalChecked,
      [memberId]: !equalChecked[memberId],
    });
  };

  const handleUnequalAmountChange = (memberId: string, val: string) => {
    setUnequalAmounts({
      ...unequalAmounts,
      [memberId]: parseFloat(val) || 0,
    });
  };

  const handlePercentageChange = (memberId: string, val: string) => {
    setPercentageRates({
      ...percentageRates,
      [memberId]: parseFloat(val) || 0,
    });
  };

  const handleUnclaimedMemberToggle = (memberId: string) => {
    if (unclaimedMembers.includes(memberId)) {
      setUnclaimedMembers(unclaimedMembers.filter((id) => id !== memberId));
    } else {
      setUnclaimedMembers([...unclaimedMembers, memberId]);
    }
  };

  const handleItemsScanned = (items: Array<{ id: string; name: string; price: number; claimedBy?: string[] }>, grandTotal?: number) => {
    setScannedItems(items);
    if (grandTotal && grandTotal > 0) {
      setAmount(grandTotal);
    } else {
      const sum = items.reduce((acc, curr) => acc + curr.price, 0);
      setAmount(parseFloat(sum.toFixed(2)));
    }
  };

  const validateForm = (): { isValid: boolean; finalSplits: any[] } => {
    setError("");

    if (!description.trim()) {
      setError("Please enter an expense description.");
      return { isValid: false, finalSplits: [] };
    }

    if (amount <= 0 && splitType !== "itemized") {
      setError("Please enter a valid amount greater than 0.");
      return { isValid: false, finalSplits: [] };
    }

    const finalSplits: any[] = [];

    if (splitType === "equal") {
      const checkedMembers = Object.keys(equalChecked).filter((id) => equalChecked[id]);
      if (checkedMembers.length === 0) {
        setError("Please select at least one member to split with.");
        return { isValid: false, finalSplits: [] };
      }

      const share = amount / checkedMembers.length;
      group.members.forEach((m) => {
        finalSplits.push({
          memberId: m.id,
          amount: equalChecked[m.id] ? parseFloat(share.toFixed(2)) : 0,
        });
      });

      // Adjust rounding discrepancy
      const totalSplit = finalSplits.reduce((sum, item) => sum + item.amount, 0);
      const diff = amount - totalSplit;
      if (Math.abs(diff) > 0.01 && checkedMembers.length > 0) {
        const index = finalSplits.findIndex((s) => s.amount > 0);
        if (index !== -1) {
          finalSplits[index].amount = parseFloat((finalSplits[index].amount + diff).toFixed(2));
        }
      }

    } else if (splitType === "unequal") {
      let sum = 0;
      group.members.forEach((m) => {
        const amt = unequalAmounts[m.id] || 0;
        sum += amt;
        finalSplits.push({
          memberId: m.id,
          amount: parseFloat(amt.toFixed(2)),
        });
      });

      if (Math.abs(sum - amount) > 0.05) {
        setError(
          `The sum of individual shares (${sum.toFixed(2)}) must equal the total amount (${amount.toFixed(2)}).`
        );
        return { isValid: false, finalSplits: [] };
      }

    } else if (splitType === "percentage") {
      let totalPercent = 0;
      group.members.forEach((m) => {
        const pct = percentageRates[m.id] || 0;
        totalPercent += pct;
        const share = (amount * pct) / 100;
        finalSplits.push({
          memberId: m.id,
          amount: parseFloat(share.toFixed(2)),
        });
      });

      if (Math.abs(totalPercent - 100) > 0.1) {
        setError(`The sum of percentages must equal 100%. Current sum: ${totalPercent}%`);
        return { isValid: false, finalSplits: [] };
      }

      // Adjust rounding discrepancies
      const totalSplit = finalSplits.reduce((sum, item) => sum + item.amount, 0);
      const diff = amount - totalSplit;
      if (Math.abs(diff) > 0.01 && finalSplits.length > 0) {
        finalSplits[0].amount = parseFloat((finalSplits[0].amount + diff).toFixed(2));
      }
    }

    return { isValid: true, finalSplits };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { isValid, finalSplits } = validateForm();
    if (!isValid) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/expenses/${expense._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: description.trim(),
          amount,
          payerId,
          splitType,
          splits: finalSplits,
          items: splitType === "itemized" ? scannedItems : undefined,
          unclaimedSplitType: splitType === "itemized" ? unclaimedSplitType : undefined,
          unclaimedMembers: splitType === "itemized" ? unclaimedMembers : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to save changes.");
      } else {
        onSuccess();
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const unequalTotal = Object.values(unequalAmounts).reduce((sum, a) => sum + a, 0);
  const unequalDiff = amount - unequalTotal;
  const percentageTotal = Object.values(percentageRates).reduce((sum, a) => sum + a, 0);

  return (
    <div className={styles.overlay}>
      <div className={styles.drawer}>
        <div className={styles.header}>
          <h2 className={styles.title}>Edit Expense</h2>
          <button onClick={onClose} className={styles.closeBtn} type="button">
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          {error && (
            <div className="btn btn-danger animate-fade-in" style={{ cursor: "default", fontSize: "14px", padding: "10px" }}>
              <AlertTriangle size={16} style={{ display: "inline-block", marginRight: "6px", verticalAlign: "middle" }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="form" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="input-group">
              <label htmlFor="expDesc">Description</label>
              <input
                id="expDesc"
                type="text"
                className="input-field"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="expAmt">Total Amount ({group.currency})</label>
              <input
                id="expAmt"
                type="number"
                step="any"
                min="0.01"
                className="input-field"
                value={amount || ""}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                required
              />
              {splitType === "itemized" && (
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px", display: "block" }}>
                  {(() => {
                    const itemsSum = scannedItems.reduce((acc, curr) => acc + (curr.price || 0), 0);
                    const diff = amount - itemsSum;
                    if (Math.abs(diff) < 0.01) {
                      return "✓ Total amount matches the sum of items.";
                    } else if (diff > 0) {
                      return `+ ${formatCurrency(diff, group.currency)} additional fees split equally by default.`;
                    } else {
                      return `- ${formatCurrency(Math.abs(diff), group.currency)} discount will be subtracted equally by default.`;
                    }
                  })()}
                </span>
              )}
            </div>

            <div className="input-group">
              <label htmlFor="expPayer">Paid By</label>
              <select
                id="expPayer"
                className="input-field"
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                style={{ backgroundColor: "rgba(0,0,0,0.2)" }}
                required
              >
                {group.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>Split Model</label>
              <div className={styles.tabSelector}>
                <button
                  type="button"
                  onClick={() => setSplitType("itemized")}
                  className={`${styles.tabButton} ${splitType === "itemized" ? styles.activeTab : ""}`}
                >
                  Claim
                </button>
                <button
                  type="button"
                  onClick={() => setSplitType("equal")}
                  className={`${styles.tabButton} ${splitType === "equal" ? styles.activeTab : ""}`}
                >
                  Equally
                </button>
                <button
                  type="button"
                  onClick={() => setSplitType("unequal")}
                  className={`${styles.tabButton} ${splitType === "unequal" ? styles.activeTab : ""}`}
                >
                  Unequally
                </button>
                <button
                  type="button"
                  onClick={() => setSplitType("percentage")}
                  className={`${styles.tabButton} ${splitType === "percentage" ? styles.activeTab : ""}`}
                >
                  Percent
                </button>
              </div>
            </div>

            <div className={styles.splitSection}>
              {splitType === "equal" && (
                <div>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "12px" }}>
                    Select who shares this expense equally:
                  </span>
                  {group.members.map((m) => (
                    <div key={m.id} className={styles.memberInputRow}>
                      <span className={styles.memberName}>{m.name}</span>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={!!equalChecked[m.id]}
                        onChange={() => handleEqualCheckboxChange(m.id)}
                      />
                    </div>
                  ))}
                  
                  <div className={styles.summaryIndicator}>
                    <span>Individual Share:</span>
                    <span className={styles.statusSuccess}>
                      {((amount || 0) / Math.max(Object.values(equalChecked).filter(Boolean).length, 1)).toFixed(2)} {group.currency}
                    </span>
                  </div>
                </div>
              )}

              {splitType === "unequal" && (
                <div>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "12px" }}>
                    Input exact amounts owed:
                  </span>
                  {group.members.map((m) => (
                    <div key={m.id} className={styles.memberInputRow}>
                      <span className={styles.memberName}>{m.name}</span>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        className={styles.splitInput}
                        value={unequalAmounts[m.id] || ""}
                        onChange={(e) => handleUnequalAmountChange(m.id, e.target.value)}
                      />
                    </div>
                  ))}

                  <div className={styles.summaryIndicator}>
                    <span>Sum: {unequalTotal.toFixed(2)}</span>
                    <span className={Math.abs(unequalDiff) < 0.05 ? styles.statusSuccess : styles.statusError}>
                      {Math.abs(unequalDiff) < 0.05 ? (
                        <>
                          <Check size={14} style={{ display: "inline", marginRight: "2px" }} /> Balanced
                        </>
                      ) : (
                        `Remaining: ${unequalDiff.toFixed(2)}`
                      )}
                    </span>
                  </div>
                </div>
              )}

              {splitType === "percentage" && (
                <div>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "12px" }}>
                    Input percentage split:
                  </span>
                  {group.members.map((m) => (
                    <div key={m.id} className={styles.memberInputRow}>
                      <span className={styles.memberName}>{m.name}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <input
                          type="number"
                          placeholder="0"
                          className={styles.splitInput}
                          value={percentageRates[m.id] || ""}
                          onChange={(e) => handlePercentageChange(m.id, e.target.value)}
                        />
                        <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>%</span>
                      </div>
                    </div>
                  ))}

                  <div className={styles.summaryIndicator}>
                    <span>Sum: {percentageTotal.toFixed(2)}%</span>
                    <span className={Math.abs(percentageTotal - 100) < 0.1 ? styles.statusSuccess : styles.statusError}>
                      {Math.abs(percentageTotal - 100) < 0.1 ? (
                        <>
                          <Check size={14} style={{ display: "inline", marginRight: "2px" }} /> Balanced
                        </>
                      ) : (
                        `Need 100% (Diff: ${(100 - percentageTotal).toFixed(1)}%)`
                      )}
                    </span>
                  </div>
                </div>
              )}

              {splitType === "itemized" && (
                <div>
                  <div className="input-group" style={{ marginBottom: "16px" }}>
                    <label htmlFor="unclaimed">Unclaimed Items Handler</label>
                    <select
                      id="unclaimed"
                      className="input-field"
                      value={unclaimedSplitType}
                      onChange={(e) => setUnclaimedSplitType(e.target.value as any)}
                      style={{ backgroundColor: "rgba(0,0,0,0.2)" }}
                    >
                      <option value="payer">Assign 100% to Payee</option>
                      <option value="equal">Split Equally among select members</option>
                    </select>
                  </div>

                  {unclaimedSplitType === "equal" && (
                    <div style={{ marginBottom: "16px", padding: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--card-border)", borderRadius: "8px" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "8px", fontWeight: 600 }}>
                        Who shares remaining/unclaimed items?
                      </span>
                      {group.members.map((m) => (
                        <div key={m.id} className={styles.memberInputRow} style={{ padding: "4px 0", borderBottom: "none" }}>
                          <span className={styles.memberName} style={{ fontSize: "13px" }}>{m.name}</span>
                          <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={unclaimedMembers.includes(m.id)}
                            onChange={() => handleUnclaimedMemberToggle(m.id)}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <BillScanner
                    currency={group.currency}
                    onItemsConfirmed={handleItemsScanned}
                  />

                  {scannedItems.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>
                      <div className={styles.summaryIndicator} style={{ background: "rgba(16, 185, 129, 0.08)", padding: "10px 12px", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.2)", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                          <FileText size={16} className="text-success" />
                          <span>{scannedItems.length} items logged. You can edit them manually below.</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto", paddingRight: "4px" }}>
                        {scannedItems.map((item, idx) => (
                          <div 
                            key={item.id || idx} 
                            style={{ 
                              display: "flex", 
                              gap: "8px", 
                              alignItems: "center", 
                              background: "rgba(255,255,255,0.02)", 
                              padding: "6px 8px", 
                              borderRadius: "8px", 
                              border: "1px solid var(--card-border)" 
                            }}
                          >
                            <input
                              type="text"
                              className="input-field"
                              style={{ flex: 2, padding: "8px", fontSize: "14px", height: "36px" }}
                              value={item.name}
                              onChange={(e) => {
                                const newItems = [...scannedItems];
                                newItems[idx] = { ...newItems[idx], name: e.target.value };
                                setScannedItems(newItems);
                              }}
                              placeholder="Item name"
                              required
                            />
                            <input
                              type="number"
                              step="any"
                              min="0"
                              className="input-field"
                              style={{ flex: 1, padding: "8px", fontSize: "14px", maxWidth: "90px", height: "36px" }}
                              value={item.price || ""}
                              onChange={(e) => {
                                const newItems = [...scannedItems];
                                newItems[idx] = { ...newItems[idx], price: parseFloat(e.target.value) || 0 };
                                setScannedItems(newItems);
                                // Update total amount automatically
                                const sum = newItems.reduce((acc, curr) => acc + (curr.price || 0), 0);
                                setAmount(parseFloat(sum.toFixed(2)));
                              }}
                              placeholder="Price"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const item = scannedItems[idx];
                                if (!window.confirm(`Are you sure you want to delete "${item?.name || "this item"}"?`)) return;
                                const newItems = scannedItems.filter((_, i) => i !== idx);
                                setScannedItems(newItems);
                                const sum = newItems.reduce((acc, curr) => acc + (curr.price || 0), 0);
                                setAmount(parseFloat(sum.toFixed(2)));
                              }}
                              className="btn btn-danger"
                              style={{ width: "32px", height: "32px", padding: 0, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                              title="Delete Item"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const newItem = {
                            id: Math.random().toString(36).substring(2, 9),
                            name: "",
                            price: 0,
                            claimedBy: []
                          };
                          setScannedItems([...scannedItems, newItem]);
                        }}
                        className="btn btn-secondary"
                        style={{ padding: "6px 12px", fontSize: "12px", width: "auto", alignSelf: "flex-start", height: "32px" }}
                      >
                        + Add Item Manually
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Calculator className="animate-spin" size={18} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
