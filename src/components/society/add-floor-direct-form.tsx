"use client";

import { useTransition } from "react";
import { addFloorDirect } from "@/actions/floors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function AddFloorDirectForm() {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addFloorDirect(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Floor added");
        const input = document.getElementById("floor-direct") as HTMLInputElement;
        if (input) input.value = "";
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex gap-2">
      <Input
        id="floor-direct"
        name="number"
        type="number"
        placeholder="Floor no. (e.g. 1)"
        className="h-9"
        min={0}
        required
      />
      <Button type="submit" size="sm" disabled={isPending} className="shrink-0">
        <Plus className="h-4 w-4 mr-1" />
        Add Floor
      </Button>
    </form>
  );
}
