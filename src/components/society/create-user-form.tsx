"use client";

import { useTransition, useState } from "react";
import { createUser } from "@/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const ROLES = [
  { value: "OWNER", label: "Owner" },
  { value: "TENANT", label: "Tenant" },
  { value: "SECRETARY", label: "Secretary" },
  { value: "TREASURER", label: "Treasurer" },
  { value: "ADMIN", label: "Admin" },
] as const;

export function CreateUserForm() {
  const [isPending, startTransition] = useTransition();
  const [selectedRole, setSelectedRole] = useState<string>("OWNER");

  function handleSubmit(formData: FormData) {
    formData.set("role", selectedRole);
    startTransition(async () => {
      const result = await createUser(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("User created successfully");
        (document.getElementById("create-user-form") as HTMLFormElement).reset();
        setSelectedRole("OWNER");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Add New User</CardTitle>
      </CardHeader>
      <CardContent>
        <form id="create-user-form" action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="user-name">Full Name *</Label>
            <Input id="user-name" name="name" placeholder="Rahul Sharma" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user-email">Email *</Label>
            <Input id="user-email" name="email" type="email" placeholder="rahul@example.com" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user-phone">Phone</Label>
            <Input id="user-phone" name="phone" type="tel" placeholder="+91 98765 43210" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user-password">Temporary Password *</Label>
            <PasswordInput id="user-password" name="password" autoComplete="new-password" placeholder="Min 8 characters" required />
          </div>
          <div className="space-y-1.5">
            <Label>Role *</Label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => setSelectedRole(role.value)}
                  className="focus:outline-none"
                >
                  <Badge
                    variant={selectedRole === role.value ? "default" : "outline"}
                    className="cursor-pointer px-3 py-1 text-xs"
                  >
                    {role.label}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating…" : "Create user"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
