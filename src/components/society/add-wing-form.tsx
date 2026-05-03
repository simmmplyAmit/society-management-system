"use client";

import { useTransition } from "react";
import { addWing } from "@/actions/wings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function AddWingForm() {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addWing(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Wing added");
        (document.getElementById("wing-name") as HTMLInputElement).value = "";
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex gap-2">
      <Input
        id="wing-name"
        name="name"
        placeholder="e.g. A, B, Wing 1"
        className="h-9"
        required
      />
      <Button type="submit" size="sm" disabled={isPending} className="shrink-0">
        <Plus className="h-4 w-4 mr-1" />
        Add
      </Button>
    </form>
  );
}
