"use client";

import { useRef, useTransition } from "react";
import { addFlat } from "@/actions/flats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { rangeSummary } from "@/lib/utils/range";

interface AddFlatFormProps {
  floorId: string;
}

export function AddFlatForm({ floorId }: AddFlatFormProps) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    formData.set("floorId", floorId);
    startTransition(async () => {
      const result = await addFlat(formData);
      if (result.error !== undefined) {
        toast.error(result.error);
      } else {
        toast.success(rangeSummary("flat", result.created, result.skipped));
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex gap-1.5 mt-1.5">
      <Input
        id={`flat-${floorId}`}
        name="number"
        placeholder="Flat no."
        className="h-7 text-xs w-24"
        required
      />
      <Input
        name="toNumber"
        placeholder="to (optional)"
        title="Fill to add a range of flats, e.g. 101 to 110 or A-101 to 110"
        className="h-7 text-xs w-24"
      />
      <Button type="submit" size="sm" variant="ghost" disabled={isPending} className="h-7 text-xs px-2 shrink-0">
        <Plus className="h-3 w-3 mr-0.5" />
        Flat
      </Button>
    </form>
  );
}
