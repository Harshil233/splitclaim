"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "@/styles/Group.module.css";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { formatCurrency, calculateDebts, Debt } from "@/lib/utils";

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
}

export default function GroupReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<{ [memberId: string]: number }>({});
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchGroupDetails = async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}`);
      if (!res.ok) {
        setError("Failed to load group details.");
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
    groupData.members.forEach((m) => {
      memberBalances[m.id] = 0;
    });

    expensesData.forEach((exp) => {
      if (memberBalances[exp.payerId] !== undefined) {
        memberBalances[exp.payerId] += exp.amount;
      }
      exp.splits.forEach((split) => {
        if (memberBalances[split.memberId] !== undefined) {
          memberBalances[split.memberId] -= split.amount;
        }
      });
    });

    setBalances(memberBalances);

    const computedDebts = calculateDebts(
      groupData.members.map((m) => ({ id: m.id, name: m.name })),
      memberBalances
    );
    setDebts(computedDebts);
  };

  const triggerPrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Generating report...</p>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div style={{ padding: "20px" }}>
        <Link href={`/groups/${groupId}`} className="btn btn-secondary" style={{ width: "auto" }}>
          <ArrowLeft size={16} /> Back to Group
        </Link>
        <div className="btn btn-danger" style={{ cursor: "default", opacity: 0.9, marginTop: "20px" }}>
          {error}
        </div>
      </div>
    );
  }

  const totalExpenseSum = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto", color: "#111827", background: "#ffffff", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      
      {/* Print styles */}
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      {/* Toolbar - hidden on print */}
      <div className="no-print" style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px",
        background: "rgba(0, 0, 0, 0.05)",
        border: "1px solid rgba(0,0,0,0.1)",
        borderRadius: "8px",
        marginBottom: "24px"
      }}>
        <Link href={`/groups/${groupId}`} className="btn btn-secondary" style={{ width: "auto", display: "flex", gap: "6px", alignItems: "center", padding: "8px 16px", color: "var(--text-primary)" }}>
          <ArrowLeft size={16} />
          Back to Group
        </Link>
        <button onClick={triggerPrint} className="btn btn-primary" style={{ width: "auto", display: "flex", gap: "6px", alignItems: "center", padding: "8px 16px" }}>
          <Printer size={16} />
          Print / Save PDF
        </button>
      </div>

      {/* Report Header */}
      <div className="print-container" style={{ borderBottom: "3px double #1f2937", paddingBottom: "16px", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "800", margin: "0 0 6px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          SplitClaim Ledger & Expense Report
        </h1>
        <h2 style={{ fontSize: "18px", fontWeight: "600", margin: "0 0 8px 0" }}>Group: {group.name}</h2>
        {group.description && <p style={{ fontSize: "14px", margin: "0 0 12px 0", color: "#4b5563", fontStyle: "italic" }}>{group.description}</p>}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#6b7280", fontWeight: "500" }}>
          <span>Generated On: {new Date().toLocaleDateString()} &bull; {new Date().toLocaleTimeString()}</span>
          <span>Currency: {group.currency}</span>
        </div>
      </div>

      {/* Summary Box */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "24px" }}>
        <div style={{ flex: 1, padding: "16px", border: "1px solid #d1d5db", borderRadius: "8px", background: "#f9fafb" }}>
          <span style={{ fontSize: "12px", textTransform: "uppercase", color: "#6b7280", fontWeight: "700" }}>Total Trip Expenses</span>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "#111827", marginTop: "4px" }}>
            {formatCurrency(totalExpenseSum, group.currency)}
          </div>
        </div>
        <div style={{ flex: 1, padding: "16px", border: "1px solid #d1d5db", borderRadius: "8px", background: "#f9fafb" }}>
          <span style={{ fontSize: "12px", textTransform: "uppercase", color: "#6b7280", fontWeight: "700" }}>Total Active Members</span>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "#111827", marginTop: "4px" }}>
            {group.members.length} Members
          </div>
        </div>
      </div>

      {/* Balances Section */}
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "700", borderBottom: "1px solid #e5e7eb", paddingBottom: "6px", marginBottom: "12px" }}>
          Member Net Balances
        </h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #e5e7eb" }}>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>Name</th>
              <th style={{ textAlign: "left", padding: "8px 12px" }}>Email</th>
              <th style={{ textAlign: "right", padding: "8px 12px" }}>Net Balance</th>
            </tr>
          </thead>
          <tbody>
            {group.members.map((m) => {
              const bal = balances[m.id] || 0;
              const isOwed = bal > 0.01;
              const isOwe = bal < -0.01;
              return (
                <tr key={m.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "8px 12px", fontWeight: "600" }}>{m.name} {m.isGuest && "(Guest)"}</td>
                  <td style={{ padding: "8px 12px", color: "#6b7280" }}>{m.email || "N/A (Guest Member)"}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: "700", color: isOwed ? "#059669" : isOwe ? "#dc2626" : "#6b7280" }}>
                    {isOwed ? "+" : ""}{formatCurrency(bal, group.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Suggested Settlements Section */}
      {debts.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "700", borderBottom: "1px solid #e5e7eb", paddingBottom: "6px", marginBottom: "12px" }}>
            Suggested Debt Settlements
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {debts.map((debt, idx) => (
              <div key={idx} style={{ padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: "6px", background: "#f9fafb", fontSize: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>
                  <strong>{debt.fromName}</strong> pays <strong>{debt.toName}</strong>
                </span>
                <span style={{ fontWeight: "700", color: "#374151" }}>
                  {formatCurrency(debt.amount, group.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Expense Log */}
      <div>
        <h3 style={{ fontSize: "16px", fontWeight: "700", borderBottom: "1px solid #e5e7eb", paddingBottom: "6px", marginBottom: "12px" }}>
          Expense Audit Ledger (Audit Log)
        </h3>
        
        {expenses.length === 0 ? (
          <p style={{ fontSize: "14px", color: "#6b7280", textAlign: "center", padding: "16px 0" }}>No expenses recorded.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {expenses.map((exp, idx) => {
              const payer = group.members.find((m) => m.id === exp.payerId);
              const payerName = payer ? payer.name : "Unknown Payer";
              return (
                <div key={exp._id} style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "14px", pageBreakInside: "avoid" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div>
                      <strong style={{ fontSize: "15px", color: "#111827" }}>{idx + 1}. {exp.description}</strong>
                      <span style={{ display: "block", fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                        Paid by {payerName} &bull; {new Date(exp.date).toLocaleDateString()} &bull; Split: {exp.splitType}
                      </span>
                    </div>
                    <span style={{ fontWeight: "800", fontSize: "15px" }}>
                      {formatCurrency(exp.amount, group.currency)}
                    </span>
                  </div>

                  {/* Itemized details in ledger */}
                  {exp.splitType === "itemized" && exp.items && exp.items.length > 0 && (
                    <div style={{ margin: "8px 0", background: "#f9fafb", padding: "8px", borderRadius: "6px", border: "1px solid #f3f4f6" }}>
                      <span style={{ fontSize: "11px", fontWeight: "700", display: "block", color: "#4b5563", marginBottom: "4px" }}>Itemized Claims Breakdown:</span>
                      {exp.items.map((item) => {
                        const claimants = item.claimedBy || [];
                        const claimantNames = claimants
                          .map((cId) => group.members.find((m) => m.id === cId)?.name)
                          .filter(Boolean);
                        
                        return (
                          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", padding: "2px 0", borderBottom: "1px dashed #e5e7eb" }}>
                            <span>
                              {item.name} {claimantNames.length > 0 ? `(Claimed by: ${claimantNames.join(", ")})` : "(Unclaimed)"}
                            </span>
                            <span style={{ fontWeight: "600" }}>{formatCurrency(item.price, group.currency)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Split amounts distribution in ledger */}
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "700", display: "block", color: "#4b5563", marginBottom: "4px" }}>Charge Distribution:</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                      {exp.splits
                        .filter((s) => s.amount > 0.01)
                        .map((split) => {
                          const m = group.members.find((member) => member.id === split.memberId);
                          return (
                            <span key={split.memberId} style={{ fontSize: "11px", background: "#f3f4f6", padding: "2px 8px", borderRadius: "4px" }}>
                              {m ? m.name : "Unknown"}: <strong>{formatCurrency(split.amount, group.currency)}</strong>
                            </span>
                          );
                        })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #e5e7eb", marginTop: "40px", paddingTop: "12px", textAlign: "center", fontSize: "11px", color: "#9ca3af" }}>
        Report powered by SplitClaim. Keep track and claim your bills.
      </div>
    </div>
  );
}
