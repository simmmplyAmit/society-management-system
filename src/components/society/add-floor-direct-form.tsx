"use client";

import { useRef, useTransition } from "react";
import { addFloorDirect } from "@/actions/floors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { rangeSummary } from "@/lib/utils/range";

export function AddFloorDirectForm() {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addFloorDirect(formData);
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
        id="floor-direct"
        name="number"
        type="number"
        placeholder="Floor no. (e.g. 1)"
        className="h-9"
        min={0}
        required
      />
      <Input
        name="toNumber"
        type="number"
        placeholder="to (optional)"
        title="Fill to add a range of floors, e.g. 1 to 5"
        className="h-9"
        min={0}
      />
      <Button type="submit" size="sm" disabled={isPending} className="shrink-0">
        <Plus className="h-4 w-4 mr-1" />
        Add Floor
      </Button>
    </form>
  );
}
