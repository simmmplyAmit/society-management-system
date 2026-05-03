"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MONTHS } from "@/lib/utils/month";

interface MonthSelectorProps {
  month: number;
  year: number;
}

export function MonthSelector({ month, year }: MonthSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(newMonth: number, newYear: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", String(newMonth));
    params.set("year", String(newYear));
    router.push(`?${params.toString()}`);
  }

  function prev() {
    if (month === 1) navigate(12, year - 1);
    else navigate(month - 1, year);
  }

  function next() {
    if (month === 12) navigate(1, year + 1);
    else navigate(month + 1, year);
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={prev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-semibold min-w-[130px] text-center">
        {MONTHS[month - 1]} {year}
      </span>
      <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={next}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
