"use client";

import { useTransition, useState } from "react";
import { assignResident } from "@/actions/residents";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { flatOptionLabel } from "@/lib/utils/flat";

interface Flat {
  id: string;
  number: string;
  floor: { number: number; wing: { name: string } };
}

interface User {
  id: string;
  name: string;
  role: string;
}

interface AssignResidentFormProps {
  flats: Flat[];
  users: User[];
  hasWings: boolean;
}

export function AssignResidentForm({ flats, users, hasWings }: AssignResidentFormProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedFlat, setSelectedFlat] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [type, setType] = useState<"OWNER" | "TENANT">("OWNER");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFlat || !selectedUser) {
      toast.error("Select both a flat and a user");
      return;
    }
    const formData = new FormData();
    formData.set("flatId", selectedFlat);
    formData.set("userId", selectedUser);
    formData.set("type", type);

    startTransition(async () => {
      const result = await assignResident(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Resident assigned");
        setSelectedFlat("");
        setSelectedUser("");
        setType("OWNER");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Assign Resident to Flat</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Select Flat *</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={selectedFlat}
              onChange={(e) => setSelectedFlat(e.target.value)}
              required
            >
              <option value="">— Choose flat —</option>
              {flats.map((flat) => (
                <option key={flat.id} value={flat.id}>
                  {flatOptionLabel(flat, hasWings)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Select User *</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              required
            >
              <option value="">— Choose user —</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role.toLowerCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Resident Type *</Label>
            <div className="flex gap-2">
              {(["OWNER", "TENANT"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)} className="focus:outline-none">
                  <Badge
                    variant={type === t ? "default" : "outline"}
                    className="cursor-pointer px-4 py-1"
                  >
                    {t === "OWNER" ? "Owner" : "Tenant"}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Assigning…" : "Assign resident"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
