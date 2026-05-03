"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface YearSelectorProps {
  year: number;
}

export function YearSelector({ year }: YearSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(newYear: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(newYear));
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => navigate(year - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-semibold w-12 text-center">{year}</span>
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => navigate(year + 1)}
        disabled={year >= new Date().getFullYear()}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
