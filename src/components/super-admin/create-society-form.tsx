"use client";

import { useTransition } from "react";
import { createSociety } from "@/actions/super-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function CreateSocietyForm() {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createSociety(formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Society created with its admin");
        (document.getElementById("create-society-form") as HTMLFormElement).reset();
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Onboard a society</CardTitle>
      </CardHeader>
      <CardContent>
        <form id="create-society-form" action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="societyName">Society name *</Label>
            <Input id="societyName" name="societyName" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="upiId">Society UPI ID</Label>
            <Input id="upiId" name="upiId" placeholder="society@bank" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adminName">Admin name *</Label>
            <Input id="adminName" name="adminName" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adminEmail">Admin email *</Label>
            <Input id="adminEmail" name="adminEmail" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adminPassword">Temporary password *</Label>
            <Input id="adminPassword" name="adminPassword" type="password" placeholder="Min 8 characters" required />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating…" : "Create society"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
