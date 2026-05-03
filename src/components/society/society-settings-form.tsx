"use client";

import { useRef, useTransition } from "react";
import { updateSociety } from "@/actions/society";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { Society } from "@prisma/client";

interface SocietySettingsFormProps {
  society: Society;
}

export function SocietySettingsForm({ society }: SocietySettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateSociety(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Society details updated");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Society Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Society Name *</Label>
            <Input id="name" name="name" defaultValue={society.name} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue={society.address ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={society.city ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" defaultValue={society.state ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pincode">Pincode</Label>
              <Input id="pincode" name="pincode" defaultValue={society.pincode ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="upiId">UPI ID</Label>
              <Input id="upiId" name="upiId" placeholder="society@upi" defaultValue={society.upiId ?? ""} />
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <input
              type="checkbox"
              id="hasWings"
              name="hasWings"
              defaultChecked={society.hasWings}
              className="mt-0.5 rounded"
            />
            <div>
              <Label htmlFor="hasWings" className="font-medium">Society has wings / blocks</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enable if your building is divided into wings or blocks (A, B, C…).
                Disable for single-block societies — floors and flats are managed directly.
              </p>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
