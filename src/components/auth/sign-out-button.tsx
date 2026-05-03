"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-destructive cursor-pointer"
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </button>
  );
}
