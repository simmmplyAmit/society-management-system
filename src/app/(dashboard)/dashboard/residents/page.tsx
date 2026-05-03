import { requireRole } from "@/lib/session";
import { getSocietyUsers } from "@/lib/queries/users";
import { CreateUserForm } from "@/components/society/create-user-form";
import { AssignResidentForm } from "@/components/society/assign-resident-form";
import { UserList } from "@/components/society/user-list";
import { prisma } from "@/lib/prisma";

export default async function ResidentsPage() {
  const session = await requireRole(["ADMIN", "SECRETARY"]);
  const societyId = session.user.societyId!;

  const [users, flats, society] = await Promise.all([
    getSocietyUsers(societyId),
    prisma.flat.findMany({
      where: { societyId },
      include: {
        floor: { include: { wing: { select: { name: true } } } },
      },
      orderBy: [{ floor: { wing: { name: "asc" } } }, { floor: { number: "asc" } }, { number: "asc" }],
    }),
    prisma.society.findUnique({ where: { id: societyId }, select: { hasWings: true } }),
  ]);

  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Residents</h2>
        <p className="text-xs text-muted-foreground">{users.length} users in this society</p>
      </div>

      {isAdmin && (
        <>
          <CreateUserForm />
          {flats.length > 0 && users.length > 0 && (
            <AssignResidentForm
              flats={flats.flatMap((f) =>
                f.floor?.wing ? [{
                  id: f.id,
                  number: f.number,
                  floor: { number: f.floor.number, wing: { name: f.floor.wing.name } },
                }] : []
              )}
              users={users.map((u) => ({ id: u.id, name: u.name, role: u.role }))}
              hasWings={society?.hasWings ?? true}
            />
          )}
        </>
      )}

      <UserList users={users} isAdmin={isAdmin} />
    </div>
  );
}
