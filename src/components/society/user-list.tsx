"use client";

import { useTransition } from "react";
import { toggleUserActive } from "@/actions/users";
import { removeResident } from "@/actions/residents";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Role } from "@prisma/client";

const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  ADMIN: "bg-red-100 text-red-700",
  SECRETARY: "bg-blue-100 text-blue-700",
  TREASURER: "bg-amber-100 text-amber-700",
  OWNER: "bg-green-100 text-green-700",
  TENANT: "bg-slate-100 text-slate-700",
};

interface FlatResident {
  id: string;
  type: "OWNER" | "TENANT";
  flat: {
    number: string;
    floor: { number: number; wing: { name: string } };
  };
}

interface UserListItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  flatResidents: FlatResident[];
}

interface UserListProps {
  users: UserListItem[];
  isAdmin: boolean;
}

function ToggleActiveButton({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 text-xs px-2"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await toggleUserActive(userId);
          if (result?.error) toast.error(result.error);
          else toast.success(isActive ? "User deactivated" : "User activated");
        })
      }
    >
      {isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}

function RemoveResidentButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      disabled={isPending}
      className="text-[10px] text-destructive underline ml-1"
      onClick={() =>
        startTransition(async () => {
          const result = await removeResident(id);
          if (result?.error) toast.error(result.error);
          else toast.success("Removed from flat");
        })
      }
    >
      remove
    </button>
  );
}

export function UserList({ users, isAdmin }: UserListProps) {
  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No users yet. Create your first user above.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {users.map((user) => {
        const initials = user.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        return (
          <Card key={user.id} className={!user.isActive ? "opacity-50" : ""}>
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="text-xs bg-slate-200">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{user.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role]}`}
                    >
                      {user.role}
                    </span>
                    {!user.isActive && (
                      <Badge variant="outline" className="text-[10px] h-4">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  {user.phone && (
                    <p className="text-xs text-muted-foreground">{user.phone}</p>
                  )}

                  {/* Flat assignments */}
                  {user.flatResidents.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {user.flatResidents.map((fr) => (
                        <span key={fr.id} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">
                          Wing {fr.flat.floor.wing.name} · F{fr.flat.floor.number} · {fr.flat.number}
                          <span className="text-muted-foreground"> ({fr.type.toLowerCase()})</span>
                          {isAdmin && <RemoveResidentButton id={fr.id} />}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <ToggleActiveButton userId={user.id} isActive={user.isActive} />
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
