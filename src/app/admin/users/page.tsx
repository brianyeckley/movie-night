import { AlertTriangle, Crown, Popcorn, Users } from "lucide-react";
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
      <div className="container py-2xl text-center">
        <div className="glass-panel no-hover denied-card">
          <span className="text-9xl"><AlertTriangle size="1em" className="inline-icon" /></span>
          <h1 className="text-6xl text-accent-color font-extrabold mt-lg mb-sm">
            Access Denied
          </h1>
          <p className="text-secondary mb-2xl">
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
    <div className="py-xl">
      <main className="container">
        {/* Banner */}
        <div className="glass-panel no-hover p-xl mb-3xl">
          <div className="flex-between flex-wrap gap-lg">
            <div>
              <h1 className="text-gradient text-8xl font-extrabold mb-sm tracking-tighter">
                <Users size="1em" className="inline-icon" /> User Management
              </h1>
              <p className="text-secondary text-xl">
                Approve new signups, manage user roles, and revoke account permissions.
              </p>
            </div>
            <Link href="/" className="btn btn-secondary">
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Users Table */}
        <div className="glass-panel no-hover p-xl overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr className="admin-table-header-row">
                <th>Display Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === currentUser.id;
                
                return (
                  <tr 
                    key={user.id} 
                    className="admin-table-row"
                  >
                    {/* Display Name */}
                    <td className="font-semibold">
                      {user.name} {isSelf && <span className="badge-you">You</span>}
                    </td>

                    {/* Username */}
                    <td className="user-table-username">
                      @{user.username}
                    </td>

                    {/* Role Badge */}
                    <td>
                      <span className={`badge ${user.role === "ADMIN" ? "badge-admin" : "badge-user"}`}>
                        {user.role === "ADMIN" ? (
                          <>
                            <Crown size="1em" className="inline-icon" /> Admin
                          </>
                        ) : (
                          <>
                            <Popcorn size="1em" className="inline-icon" /> User
                          </>
                        )}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td>
                      <span className={`badge ${user.isApproved ? "badge-approved" : "badge-pending"}`}>
                        {user.isApproved ? "Approved" : "Pending Approval"}
                      </span>
                    </td>

                    {/* Action Controls */}
                    <td className="text-right">
                      <div className="inline-flex items-center gap-md">
                        
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
                              className={`btn btn-secondary btn-approve-toggle ${user.isApproved ? "approved" : "pending"}`}
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
                              className="btn btn-secondary btn-role-toggle"
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
