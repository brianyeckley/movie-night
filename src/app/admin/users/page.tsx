import { db } from "@/lib/db";
import { 
  getActiveUser, 
  toggleUserApprovalAction, 
  changeUserRoleAction 
} from "@/app/actions/user";
import Link from "next/link";
import DeleteUserButton from "@/components/DeleteUserButton";

export const dynamic = "force-dynamic";

export default async function UserManagementPage() {
  const currentUser = await getActiveUser();

  // Additional server safety check
  if (!currentUser || currentUser.role !== "ADMIN") {
    return (
      <div className="container" style={{ padding: "80px 24px", textAlign: "center" }}>
        <div className="glass-panel no-hover" style={{ padding: "48px", maxWidth: "600px", margin: "0 auto", border: "1px solid var(--accent)" }}>
          <span style={{ fontSize: "3rem" }}>⚠️</span>
          <h1 style={{ fontSize: "2rem", color: "var(--accent)", margin: "16px 0 8px 0", fontWeight: 800 }}>
            Access Denied
          </h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: "32px" }}>
            You do not have administrative permissions to access this dashboard.
          </p>
          <Link href="/" className="btn btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Fetch all users in the system
  const users = await db.user.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div style={{ padding: "40px 0" }}>
      <main className="container">
        {/* Banner */}
        <div className="glass-panel no-hover" style={{ padding: "32px", marginBottom: "40px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h1 className="text-gradient" style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "8px", letterSpacing: "-0.03em" }}>
                👥 User Management
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem" }}>
                Approve new signups, manage user roles, and revoke account permissions.
              </p>
            </div>
            <Link href="/" className="btn btn-secondary">
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Users Table */}
        <div className="glass-panel no-hover" style={{ padding: "32px", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--glass-border)", textAlign: "left" }}>
                <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase" }}>Display Name</th>
                <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase" }}>Username</th>
                <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase" }}>Role</th>
                <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase" }}>Status</th>
                <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === currentUser.id;
                
                return (
                  <tr 
                    key={user.id} 
                    style={{ 
                      borderBottom: "1px solid var(--glass-border)", 
                      transition: "background var(--transition-fast)" 
                    }}
                    className="user-table-row"
                  >
                    {/* Display Name */}
                    <td style={{ padding: "16px", fontWeight: 600 }}>
                      {user.name} {isSelf && <span style={{ fontSize: "0.75rem", backgroundColor: "rgba(255, 255, 255, 0.08)", color: "var(--text-secondary)", padding: "2px 6px", borderRadius: "var(--radius-sm)", marginLeft: "4px" }}>You</span>}
                    </td>

                    {/* Username */}
                    <td style={{ padding: "16px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}>
                      @{user.username}
                    </td>

                    {/* Role Badge */}
                    <td style={{ padding: "16px" }}>
                      <span 
                        style={{ 
                          fontSize: "0.75rem", 
                          backgroundColor: user.role === "ADMIN" ? "var(--primary-light)" : "var(--bg-tertiary)", 
                          color: user.role === "ADMIN" ? "var(--primary)" : "var(--text-secondary)", 
                          padding: "4px 10px", 
                          borderRadius: "var(--radius-full)", 
                          fontWeight: 700,
                          border: user.role === "ADMIN" ? "1px solid var(--primary)" : "1px solid var(--glass-border)"
                        }}
                      >
                        {user.role === "ADMIN" ? "👑 Admin" : "🍿 User"}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: "16px" }}>
                      <span 
                        style={{ 
                          fontSize: "0.75rem", 
                          backgroundColor: user.isApproved ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)", 
                          color: user.isApproved ? "var(--success)" : "var(--warning)", 
                          padding: "4px 10px", 
                          borderRadius: "var(--radius-full)", 
                          fontWeight: 700,
                          border: user.isApproved ? "1px solid var(--success)" : "1px solid var(--warning)"
                        }}
                      >
                        {user.isApproved ? "Approved" : "Pending Approval"}
                      </span>
                    </td>

                    {/* Action Controls */}
                    <td style={{ padding: "16px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "12px", alignItems: "center" }}>
                        
                        {/* Approval Toggle (disabled for self) */}
                        {!isSelf && (
                          <form 
                            action={async () => {
                              "use server";
                              await toggleUserApprovalAction(user.id);
                            }}
                          >
                            <button 
                              type="submit" 
                              className="btn btn-secondary" 
                              style={{ 
                                padding: "6px 12px", 
                                fontSize: "0.8rem", 
                                color: user.isApproved ? "var(--warning)" : "var(--success)", 
                                borderColor: user.isApproved ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)",
                                minWidth: "90px"
                              }}
                            >
                              {user.isApproved ? "Revoke" : "Approve"}
                            </button>
                          </form>
                        )}

                        {/* Role Change Toggle (disabled for self) */}
                        {!isSelf && (
                          <form 
                            action={async () => {
                              "use server";
                              const nextRole = user.role === "ADMIN" ? "USER" : "ADMIN";
                              await changeUserRoleAction(user.id, nextRole);
                            }}
                          >
                            <button 
                              type="submit" 
                              className="btn btn-secondary" 
                              style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                            >
                              {user.role === "ADMIN" ? "Demote" : "Promote"}
                            </button>
                          </form>
                        )}

                        {/* Delete User (disabled for self) */}
                        {!isSelf && (
                          <DeleteUserButton userId={user.id} userName={user.name} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
