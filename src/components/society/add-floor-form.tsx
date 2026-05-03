"use client";

import { useTransition } from "react";
import { addFloor } from "@/actions/floors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface AddFloorFormProps {
  wingId: string;
}

export function AddFloorForm({ wingId }: AddFloorFormProps) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    formData.set("wingId", wingId);
    startTransition(async () => {
      const result = await addFloor(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Floor added");
        const input = document.getElementById(`floor-${wingId}`) as HTMLInputElement;
        if (input) input.value = "";
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex gap-2">
      <Input
        id={`floor-${wingId}`}
        name="number"
        type="number"
        placeholder="Floor no."
        className="h-8 w-28 text-sm"
        min={0}
        required
      />
      <Button type="submit" size="sm" variant="outline" disabled={isPending} className="h-8 text-xs shrink-0">
        <Plus className="h-3 w-3 mr-1" />
        Floor
      </Button>
    </form>
  );
}
