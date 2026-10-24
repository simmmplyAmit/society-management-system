"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";

export interface AccountOption {
  id: string;
  name: string;
  isPrimary: boolean;
}

const field =
  "h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Form fields for where money moved: Bank or Cash (`channel`), and which bank account
 * (`bankAccountId`) when the society has more than one. With one account nothing extra is shown;
 * leaving the account empty means the primary account.
 */
export function AccountFields({
  accounts,
  channelLabel,
  showChannel = true,
  defaultChannel = "BANK",
  defaultAccountId,
}: {
  accounts: AccountOption[];
  channelLabel?: string;
  showChannel?: boolean;
  defaultChannel?: "BANK" | "CASH";
  defaultAccountId?: string | null;
}) {
  const [channel, setChannel] = useState<"BANK" | "CASH">(defaultChannel);
  const showAccount = accounts.length > 1 && channel === "BANK";
  if (!showChannel && !showAccount) return null;

  const primary = accounts.find((a) => a.isPrimary)?.id ?? "";
  return (
    <div className={showChannel && showAccount ? "grid grid-cols-2 gap-3" : "space-y-1.5"}>
      {showChannel && (
        <div className="space-y-1.5">
          <Label>{channelLabel ?? "Paid from"}</Label>
          <select name="channel" value={channel} onChange={(e) => setChannel(e.target.value as "BANK" | "CASH")} className={field}>
            <option value="BANK">Bank</option>
            <option value="CASH">Cash in hand</option>
          </select>
        </div>
      )}
      {showAccount && (
        <div className="space-y-1.5">
          <Label>Bank account</Label>
          <select name="bankAccountId" defaultValue={defaultAccountId ?? primary} className={field}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
