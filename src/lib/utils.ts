export function formatCurrency(amount: number, currencyCode: string = "INR") {
  const symbols: { [key: string]: string } = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
  };
  const symbol = symbols[currencyCode] || "";
  return `${symbol}${amount.toFixed(2)}`;
}

export interface Debt {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

export function calculateDebts(
  members: Array<{ id: string; name: string }>,
  balances: { [memberId: string]: number }
): Debt[] {
  const debtors: Array<{ id: string; name: string; amount: number }> = [];
  const creditors: Array<{ id: string; name: string; amount: number }> = [];

  for (const m of members) {
    const bal = balances[m.id] || 0;
    if (bal < -0.01) {
      debtors.push({ id: m.id, name: m.name, amount: -bal });
    } else if (bal > 0.01) {
      creditors.push({ id: m.id, name: m.name, amount: bal });
    }
  }

  // Sort descending
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const debts: Debt[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.01) {
      debts.push({
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amount: amount,
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount <= 0.01) {
      i++;
    }
    if (creditor.amount <= 0.01) {
      j++;
    }
  }

  return debts;
}

export function copyToClipboard(text: string): boolean {
  if (typeof window === 'undefined') return false;

  // Modern clipboard API (works on HTTPS/localhost)
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(text);
    return true;
  }

  // Fallback for insecure context (HTTP local network)
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("Fallback copy failed:", err);
    return false;
  }
}

export function calculateItemizedSplits(
  totalAmount: number,
  payerId: string,
  items: Array<{ id: string; name: string; price: number; claimedBy?: string[] }>,
  memberIds: string[],
  unclaimedSplitType: "equal" | "payer"
) {
  const splitsMap: { [memberId: string]: number } = {};
  memberIds.forEach((id) => {
    splitsMap[id] = 0;
  });

  // Calculate sum of all items in the checklist
  const totalItemsSum = items.reduce((sum, item) => sum + (item.price || 0), 0);

  // Calculate net difference (taxes/fees if positive, discount if negative)
  const netDifference = totalAmount - totalItemsSum;

  // Split this difference equally among all members
  if (Math.abs(netDifference) > 0.001 && memberIds.length > 0) {
    const differenceShare = netDifference / memberIds.length;
    memberIds.forEach((id) => {
      splitsMap[id] += differenceShare;
    });
  }

  // Calculate claimed and unclaimed portions of the items list
  items.forEach((item) => {
    const price = item.price || 0;
    const claimants = item.claimedBy || [];

    if (claimants.length > 0) {
      // Split item price among claimants
      const share = price / claimants.length;
      claimants.forEach((cId: string) => {
        if (splitsMap[cId] !== undefined) {
          splitsMap[cId] += share;
        }
      });
    } else {
      // Item is unclaimed. Apply unclaimed split type logic
      if (unclaimedSplitType === "payer") {
        if (splitsMap[payerId] !== undefined) {
          splitsMap[payerId] += price;
        }
      } else {
        // Split equally among all group members
        if (memberIds.length > 0) {
          const share = price / memberIds.length;
          memberIds.forEach((id) => {
            if (splitsMap[id] !== undefined) {
              splitsMap[id] += share;
            }
          });
        }
      }
    }
  });

  // Round and adjust for float precision/rounding errors against the payer
  const result = Object.keys(splitsMap).map((memberId) => ({
    memberId,
    amount: parseFloat(splitsMap[memberId].toFixed(2)),
  }));

  const currentSum = result.reduce((sum, item) => sum + item.amount, 0);
  const diff = parseFloat((totalAmount - currentSum).toFixed(2));
  if (Math.abs(diff) > 0.001) {
    const targetItem = result.find((r) => r.memberId === payerId) || result[0];
    if (targetItem) {
      targetItem.amount = parseFloat((targetItem.amount + diff).toFixed(2));
    }
  }

  return result;
}


