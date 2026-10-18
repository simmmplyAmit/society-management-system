"use client";

import { useRef, useTransition } from "react";
import { addFloor } from "@/actions/floors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { rangeSummary } from "@/lib/utils/range";

interface AddFloorFormProps {
  wingId: string;
}

export function AddFloorForm({ wingId }: AddFloorFormProps) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    formData.set("wingId", wingId);
    startTransition(async () => {
      const result = await addFloor(formData);
      if (result.error !== undefined) {
        toast.error(result.error);
      } else {
        toast.success(rangeSummary("floor", result.created, result.skipped));
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex gap-2">
      <Input
        id={`floor-${wingId}`}
        name="number"
        type="number"
        placeholder="Floor no."
        className="h-8 w-28 text-sm"
        min={0}
        required
      />
      <Input
        name="toNumber"
        type="number"
        placeholder="to (optional)"
        title="Fill to add a range of floors, e.g. 1 to 5"
        className="h-8 w-28 text-sm"
        min={0}
      />
      <Button type="submit" size="sm" variant="outline" disabled={isPending} className="h-8 text-xs shrink-0">
        <Plus className="h-3 w-3 mr-1" />
        Floor
      </Button>
    </form>
  );
}
