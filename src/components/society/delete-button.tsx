"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface DeleteButtonProps {
  action: (id: string) => Promise<{ success?: boolean; error?: string }>;
  id: string;
  label?: string;
}

export function DeleteButton({ action, id, label }: DeleteButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      className="h-7 w-7 p-0 text-slate-400 hover:text-destructive"
      onClick={() =>
        startTransition(async () => {
          const result = await action(id);
          if (result?.error) toast.error(result.error);
          else toast.success(label ? `${label} removed` : "Removed");
        })
      }
    >
      <Trash2 className="h-3.5 w-3.5" />
      <span className="sr-only">Delete</span>
    </Button>
  );
}
