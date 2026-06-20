"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "@/styles/Expense.module.css";
import groupStyles from "@/styles/Group.module.css";
import { ArrowLeft, Save, Calculator, AlertTriangle, FileText, Check } from "lucide-react";
import Link from "next/link";
import BillScanner from "@/components/BillScanner";
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

export default function AddExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const [group, setGroup] = useState<Group | null>(null);
  const [loadingGroup, setLoadingGroup] = useState(true);
  
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [payerId, setPayerId] = useState("");
  const [splitType, setSplitType] = useState<"equal" | "unequal" | "percentage" | "itemized">("itemized");
  
  // Equal Split state
  const [equalChecked, setEqualChecked] = useState<{ [memberId: string]: boolean }>({});
  
  // Unequal Split state
  const [unequalAmounts, setUnequalAmounts] = useState<{ [memberId: string]: number }>({});
  
  // Percentage Split state
  const [percentageRates, setPercentageRates] = useState<{ [memberId: string]: number }>({});
  
  // Itemized split state
  const [scannedItems, setScannedItems] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [unclaimedSplitType, setUnclaimedSplitType] = useState<"equal" | "payer">("payer");

  const [error, setError] = useState("");
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  // Fetch group details
  const fetchGroupDetails = async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}`);
      if (!res.ok) {
        setError("Failed to load group details.");
        return;
      }
      const data = await res.json();
      setGroup(data.group);
      
      // Default payer is the current user
      const currentUserId = (session?.user as any)?.id;
      const currentUserEmail = session?.user?.email?.toLowerCase();
      
      const matchingMember = data.group.members.find(
        (m: any) => m.id === currentUserId || (m.email && m.email === currentUserEmail)
      );
      
      if (matchingMember) {
        setPayerId(matchingMember.id);
      } else if (data.group.members.length > 0) {
        setPayerId(data.group.members[0].id);
      }

      // Default checked for equal split is all members
      const initialChecked: { [memberId: string]: boolean } = {};
      data.group.members.forEach((m: any) => {
        initialChecked[m.id] = true;
      });
      setEqualChecked(initialChecked);
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoadingGroup(false);
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

  const handleItemsScanned = (items: Array<{ id: string; name: string; price: number }>, grandTotal?: number) => {
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

    if (!group) return { isValid: false, finalSplits: [] };

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

      // Adjust any rounding discrepancy
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
    if (!group) return;

    const { isValid, finalSplits } = validateForm();
    if (!isValid) return;

    setLoadingSubmit(true);

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          groupId: group._id,
          description: description.trim(),
          amount,
          payerId,
          splitType,
          splits: finalSplits,
          items: splitType === "itemized" ? scannedItems : undefined,
          unclaimedSplitType: splitType === "itemized" ? unclaimedSplitType : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to log expense.");
      } else {
        router.push(`/groups/${groupId}`);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoadingSubmit(false);
    }
  };

  if (loadingGroup) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading group information...</p>
      </div>
    );
  }

  if (error && !group) {
    return (
      <div style={{ padding: "16px", maxWidth: "480px", margin: "0 auto" }}>
        <Link href={`/groups/${groupId}`} className="btn btn-secondary" style={{ width: "auto", padding: "8px 16px" }}>
          <ArrowLeft size={16} /> Back to Group
        </Link>
        <div className="btn btn-danger" style={{ cursor: "default", opacity: 0.9, marginTop: "20px" }}>
          {error}
        </div>
      </div>
    );
  }

  const unequalTotal = Object.values(unequalAmounts).reduce((sum, a) => sum + a, 0);
  const unequalDiff = amount - unequalTotal;
  const percentageTotal = Object.values(percentageRates).reduce((sum, a) => sum + a, 0);

  return (
    <div className={groupStyles.container} style={{ maxWidth: "600px", margin: "0 auto", paddingBottom: "48px" }}>
      <div className={groupStyles.header}>
        <Link href={`/groups/${groupId}`} className="btn btn-secondary" style={{ width: "auto", padding: "8px 16px" }}>
          <ArrowLeft size={16} />
          Back
        </Link>
        <h1 className={groupStyles.title}>Add Expense</h1>
        <div style={{ width: "80px" }}></div>
      </div>

      <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "-10px", textAlign: "center" }}>
        Adding an expense to **{group?.name}**
      </p>

      {error && (
        <div className="btn btn-danger animate-fade-in" style={{ cursor: "default", fontSize: "14px", padding: "10px" }}>
          <AlertTriangle size={16} style={{ display: "inline-block", marginRight: "6px", verticalAlign: "middle" }} />
          {error}
        </div>
      )}

      <div className={groupStyles.card}>
        <form onSubmit={handleSubmit} className="form" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="input-group">
            <label htmlFor="expDesc">Description</label>
            <input
              id="expDesc"
              type="text"
              placeholder="e.g. Dinner, Taxi, Drinks"
              className="input-field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="expAmt">Total Amount ({group?.currency})</label>
              <input
                id="expAmt"
                type="number"
                step="0.01"
                min="0.01"
                className="input-field"
                value={amount || ""}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                required
              />
              {splitType === "itemized" && group && (
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px", display: "block" }}>
                  {(() => {
                    const itemsSum = scannedItems.reduce((acc, curr) => acc + curr.price, 0);
                    const diff = amount - itemsSum;
                    if (Math.abs(diff) < 0.01) {
                      return "✓ Total amount matches the sum of items.";
                    } else if (diff > 0) {
                      return `+ ${formatCurrency(diff, group.currency)} additional fees (delivery, handling, taxes) split equally by default.`;
                    } else {
                      return `- ${formatCurrency(Math.abs(diff), group.currency)} discount will be subtracted/distributed by default.`;
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
              {group?.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Split Type Tabs */}
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

          {/* Splitting Details Render */}
          <div className={styles.splitSection}>
            {splitType === "equal" && (
              <div>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "12px" }}>
                  Select who shares this expense equally:
                </span>
                {group?.members.map((m) => (
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
                    {((amount || 0) / Math.max(Object.values(equalChecked).filter(Boolean).length, 1)).toFixed(2)} {group?.currency}
                  </span>
                </div>
              </div>
            )}

            {splitType === "unequal" && (
              <div>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "12px" }}>
                  Input exact amounts owed:
                </span>
                {group?.members.map((m) => (
                  <div key={m.id} className={styles.memberInputRow}>
                    <span className={styles.memberName}>{m.name}</span>
                    <input
                      type="number"
                      step="0.01"
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
                {group?.members.map((m) => (
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

            {splitType === "itemized" && group && (
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
                    <option value="equal">Split Equally among all</option>
                  </select>
                </div>

                <BillScanner
                  currency={group.currency}
                  onItemsConfirmed={handleItemsScanned}
                />

                {scannedItems.length > 0 && (
                  <div className={styles.summaryIndicator} style={{ background: "rgba(16, 185, 129, 0.08)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <FileText size={18} className="text-success" />
                      <span>{scannedItems.length} items scanned successfully!</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: "12px" }}
            disabled={loadingSubmit}
          >
            {loadingSubmit ? (
              <>
                <Calculator className="animate-spin" size={18} />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Log Expense
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
