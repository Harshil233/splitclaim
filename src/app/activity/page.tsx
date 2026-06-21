"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "@/styles/Activity.module.css";
import { 
  Plus, Edit2, Trash2, CheckCircle, RefreshCw, 
  BellOff, Calendar, ChevronRight 
} from "lucide-react";

export default function ActivityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Map user member IDs for read highlight checks
  const [userMemberIds, setUserMemberIds] = useState<string[]>([]);

  const fetchActivities = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    
    try {
      const res = await fetch(`/api/activities?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) {
        setError("Failed to fetch activity logs.");
        return;
      }
      const data = await res.json();
      setActivities(data.activities || []);

      // Derive member IDs from session/groups if available
      // Let's fetch groups user belongs to to build member IDs map
      const groupsRes = await fetch("/api/groups");
      if (groupsRes.ok) {
        const groupsData = await groupsRes.json();
        const mainId = (session?.user as any)?.id;
        const mainEmail = session?.user?.email?.toLowerCase();
        
        const ids = new Set<string>();
        if (mainId) ids.add(mainId);
        
        groupsData.groups?.forEach((g: any) => {
          const match = g.members.find(
            (m: any) => m.id === mainId || (m.email && m.email === mainEmail)
          );
          if (match) ids.add(match.id);
        });
        setUserMemberIds(Array.from(ids));
      }

      // Mark all as read immediately after loading
      await fetch("/api/activities", { method: "POST" });
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      fetchActivities();
    }
  }, [status]);

  const handleActivityClick = (groupId: string) => {
    router.push(`/groups/${groupId}`);
  };

  const getRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHrs = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHrs / 24);

      if (diffSecs < 60) return "just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHrs < 24) return `${diffHrs}h ago`;
      if (diffDays === 1) return "yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch (e) {
      return "";
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading activity feed...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Activity</h1>
          <span className={styles.subtitle}>Recent transactions and settlements in your groups</span>
        </div>
        <button
          onClick={() => fetchActivities(true)}
          className="btn btn-secondary"
          style={{ width: "auto", padding: "8px 12px" }}
          title="Refresh activities"
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {error && <div className="btn btn-danger" style={{ cursor: "default" }}>{error}</div>}

      <div className={styles.feed}>
        {activities.length === 0 ? (
          <div className="glass-card" style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-secondary)", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <BellOff size={40} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
            <p style={{ fontSize: "14px" }}>No recent activity to show.</p>
          </div>
        ) : (
          activities.map((act) => {
            // Check if unread (User member ID is NOT in readBy and user is NOT performer)
            const isPerformer = userMemberIds.includes(act.performedBy.id);
            const isRead = act.readBy.some((id: string) => userMemberIds.includes(id));
            const isUnread = !isPerformer && !isRead;

            // Pick icon and style class
            let icon = <Plus size={18} />;
            let iconClass = styles.iconCreate;
            if (act.type === "update_expense") {
              icon = <Edit2 size={16} />;
              iconClass = styles.iconUpdate;
            } else if (act.type === "delete_expense") {
              icon = <Trash2 size={16} />;
              iconClass = styles.iconDelete;
            } else if (act.type === "settle") {
              icon = <CheckCircle size={18} />;
              iconClass = styles.iconSettle;
            }

            return (
              <div 
                key={act._id} 
                className={`${styles.activityCard} ${isUnread ? styles.unreadHighlight : ""}`}
                onClick={() => handleActivityClick(act.groupId)}
              >
                <div className={`${styles.iconWrapper} ${iconClass}`}>
                  {icon}
                </div>
                
                <div className={styles.content}>
                  <div className={styles.text}>
                    <strong>{act.performedBy.name}</strong> {act.description}
                  </div>
                  <div className={styles.meta}>
                    <span className={styles.groupName}>{act.groupName}</span>
                    <span>&bull;</span>
                    <span className={styles.time}>{getRelativeTime(act.createdAt)}</span>
                  </div>
                </div>

                {isUnread && <span className={styles.unreadDot}></span>}
                
                <ChevronRight size={16} style={{ alignSelf: "center", color: "var(--text-muted)", opacity: 0.5 }} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
