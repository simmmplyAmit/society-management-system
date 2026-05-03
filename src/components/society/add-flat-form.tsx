"use client";

import { useTransition } from "react";
import { addFlat } from "@/actions/flats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface AddFlatFormProps {
  floorId: string;
}

export function AddFlatForm({ floorId }: AddFlatFormProps) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    formData.set("floorId", floorId);
    startTransition(async () => {
      const result = await addFlat(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Flat added");
        const input = document.getElementById(`flat-${floorId}`) as HTMLInputElement;
        if (input) input.value = "";
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex gap-1.5 mt-1.5">
      <Input
        id={`flat-${floorId}`}
        name="number"
        placeholder="Flat no."
        className="h-7 text-xs w-24"
        required
      />
      <Button type="submit" size="sm" variant="ghost" disabled={isPending} className="h-7 text-xs px-2 shrink-0">
        <Plus className="h-3 w-3 mr-0.5" />
        Flat
      </Button>
    </form>
  );
}
