"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { RoleGuide } from "@/lib/help-content";

interface RoleGuideCardProps {
  guide: RoleGuide;
  isCurrentRole: boolean;
  defaultOpen?: boolean;
}

export function RoleGuideCard({ guide, isCurrentRole, defaultOpen }: RoleGuideCardProps) {
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${guide.color}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold text-base ${guide.textColor}`}>
              {guide.label}
            </h3>
            {isCurrentRole && (
              <Badge variant="secondary" className="text-[10px] px-1.5">You</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{guide.tagline}</p>
        </div>
      </div>

      {/* Sections accordion */}
      <Accordion
        multiple
        defaultValue={defaultOpen ? guide.sections.map((s) => s.id) : []}
        className="space-y-1"
      >
        {guide.sections.map((section) => (
          <AccordionItem
            key={section.id}
            value={section.id}
            className="bg-white/70 rounded-lg border-0 px-3 data-[state=open]:shadow-sm"
          >
            <AccordionTrigger className="py-2.5 text-sm font-medium hover:no-underline">
              <span className="flex items-center gap-2">
                <span className="text-base leading-none">{section.icon}</span>
                <span>{section.title}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <p className="text-xs text-muted-foreground mb-3">{section.summary}</p>
              <ol className="space-y-3">
                {section.steps.map((step) => (
                  <li key={step.step} className="flex gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                      {step.step}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{step.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {step.description}
                      </p>
                      {step.path && (
                        <Link
                          href={step.path}
                          className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-slate-700 underline underline-offset-2"
                        >
                          {step.pathLabel}
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
