"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/Group.module.css";
import { Users, UserPlus, Trash2, ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

interface MemberInput {
  name: string;
  email: string;
  isGuest: boolean;
}

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [members, setMembers] = useState<MemberInput[]>([]);
  
  // Single member add fields
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) return;

    // Check for duplicate name
    if (members.some(m => m.name.toLowerCase() === memberName.trim().toLowerCase())) {
      setError("A member with this name already exists in the list.");
      return;
    }

    // Check for duplicate email
    if (memberEmail.trim() && members.some(m => m.email.toLowerCase() === memberEmail.trim().toLowerCase())) {
      setError("A member with this email already exists in the list.");
      return;
    }

    const emailVal = memberEmail.trim();
    const newMember: MemberInput = {
      name: memberName.trim(),
      email: emailVal,
      isGuest: emailVal ? false : true
    };

    setMembers([...members, newMember]);
    setMemberName("");
    setMemberEmail("");
    setError("");
  };

  const handleRemoveMember = (index: number) => {
    const member = members[index];
    if (!window.confirm(`Are you sure you want to remove "${member?.name || "this member"}"?`)) return;
    setMembers(members.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Group name is required.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          currency,
          members
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to create group.");
      } else {
        router.push(`/groups/${data.group._id}`);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/dashboard" className="btn btn-secondary" style={{ width: "auto", padding: "8px 16px" }}>
          <ArrowLeft size={16} />
          Back
        </Link>
        <h1 className={styles.title}>Create Group</h1>
        <div style={{ width: "80px" }}></div> {/* balance space */}
      </div>

      {error && <div className="btn btn-danger" style={{ cursor: "default", opacity: 0.9 }}>{error}</div>}

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>
          <Users size={20} />
          Group Info
        </h2>

        <form onSubmit={handleSubmit} className="form">
          <div className="input-group">
            <label htmlFor="groupName">Group Name</label>
            <input
              id="groupName"
              type="text"
              placeholder="e.g. Goa Trip 2026"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="groupDesc">Description (Optional)</label>
            <input
              id="groupDesc"
              type="text"
              placeholder="e.g. Shared expenses for the weekend getaway"
              className="input-field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label htmlFor="currency">Currency</label>
            <select
              id="currency"
              className="input-field"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              style={{ backgroundColor: "rgba(0, 0, 0, 0.2)" }}
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--card-border)", margin: "20px 0" }} />

          <h2 className={styles.sectionTitle}>Add Friends</h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>
            Add people you'll split bills with. If they don't have an email, they'll be added as guest members.
          </p>

          <div className={styles.addMemberForm}>
            <div className={styles.addMemberInputs}>
              <input
                type="text"
                placeholder="Name"
                className="input-field"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
              />
              <input
                type="email"
                placeholder="Email (optional)"
                className="input-field"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
              />
            </div>
            <button type="button" onClick={handleAddMember} className="btn btn-secondary">
              <UserPlus size={16} />
              Add Member to List
            </button>
          </div>

          <div className={styles.membersList}>
            {members.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "14px", padding: "16px 0" }}>
                No members added yet (you are added automatically as the host).
              </p>
            ) : (
              members.map((member, index) => (
                <div key={index} className={styles.memberRow}>
                  <div className={styles.memberInfo}>
                    <span className={styles.memberName}>{member.name}</span>
                    {member.email && <span className={styles.memberEmail}>{member.email}</span>}
                  </div>
                  <span className={`${styles.badge} ${member.isGuest ? styles.badgeGuest : styles.badgeUser}`}>
                    {member.isGuest ? "Guest" : "User"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(index)}
                    className={styles.deleteBtn}
                    title="Remove member"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: "24px" }}
            disabled={loading}
          >
            <Save size={18} />
            {loading ? "Creating Group..." : "Create Group"}
          </button>
        </form>
      </div>
    </div>
  );
}
