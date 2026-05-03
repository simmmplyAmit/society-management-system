import type { Role } from "@prisma/client";

export interface JourneyStep {
  step: number;
  title: string;
  description: string;
  path?: string;
  pathLabel?: string;
}

export interface JourneySection {
  id: string;
  title: string;
  icon: string;
  summary: string;
  steps: JourneyStep[];
}

export interface RoleGuide {
  role: Role;
  label: string;
  tagline: string;
  color: string; // tailwind bg class
  textColor: string;
  sections: JourneySection[];
}

export const ROLE_GUIDES: RoleGuide[] = [
  // ─────────────────────────────────────────────
  // ADMIN
  // ─────────────────────────────────────────────
  {
    role: "ADMIN",
    label: "Society Admin",
    tagline: "Set up and manage the entire society",
    color: "bg-red-50 border-red-200",
    textColor: "text-red-700",
    sections: [
      {
        id: "admin-onboarding",
        title: "Step 1 — Society Setup",
        icon: "🏢",
        summary: "Configure your society's details before adding any residents.",
        steps: [
          {
            step: 1,
            title: "Fill society details",
            description:
              "Go to Society → scroll to Society Details. Enter the society name, address, city, state, pincode, and your UPI ID (used by residents to pay maintenance).",
            path: "/dashboard/society",
            pathLabel: "Society page",
          },
          {
            step: 2,
            title: "Add Wings",
            description:
              "In the Building Structure section, type a wing name (e.g. A, B, Wing 1) and tap Add. Repeat for every wing in your society.",
            path: "/dashboard/society",
            pathLabel: "Society → Building Structure",
          },
          {
            step: 3,
            title: "Add Floors to each Wing",
            description:
              "Under each wing, enter a floor number (0 for ground floor, 1 for first floor, etc.) and tap + Floor.",
          },
          {
            step: 4,
            title: "Add Flats to each Floor",
            description:
              "Under each floor, type the flat number (e.g. 101, A-201) and tap + Flat. Occupied flats are shown in filled badges; vacant ones in outline.",
          },
        ],
      },
      {
        id: "admin-users",
        title: "Step 2 — Create Users & Assign Flats",
        icon: "👥",
        summary: "Create accounts for residents, secretary, and treasurer, then map them to their flats.",
        steps: [
          {
            step: 1,
            title: "Create a user account",
            description:
              "Go to Residents → Add New User. Fill in name, email, phone, a temporary password, and select their role (Owner, Tenant, Secretary, Treasurer, or Admin).",
            path: "/dashboard/residents",
            pathLabel: "Residents page",
          },
          {
            step: 2,
            title: "Assign user to a flat",
            description:
              "In the Assign Resident to Flat section, pick the flat and the user, then choose Owner or Tenant. For tenants, a move-in record is automatically created.",
          },
          {
            step: 3,
            title: "Remove a resident",
            description:
              "In the user card, tap the remove link next to the flat assignment. For tenants, the occupancy end-date is recorded automatically.",
          },
          {
            step: 4,
            title: "Deactivate / reactivate a user",
            description:
              "Use the Deactivate / Activate toggle on any user card. Deactivated users cannot log in but their history is preserved.",
          },
        ],
      },
      {
        id: "admin-maintenance",
        title: "Step 3 — Set Maintenance Charges",
        icon: "💰",
        summary: "Tag a monthly amount to each flat and generate payment records.",
        steps: [
          {
            step: 1,
            title: "Set a charge per flat",
            description:
              "Go to Maintenance → scroll down to Maintenance Charges → Set Maintenance Charge. Pick the flat, enter the monthly amount, set the start month/year, and optionally an end date. Leave end date empty for ongoing charges.",
            path: "/dashboard/maintenance",
            pathLabel: "Maintenance page",
          },
          {
            step: 2,
            title: "Generate monthly payment records",
            description:
              "At the top of the Maintenance page, select the month and year, then tap Generate. One PENDING record is created per flat that has an active charge. Already-existing records are skipped.",
          },
          {
            step: 3,
            title: "Mark a payment as paid",
            description:
              "In the payment list, expand any flat's card, enter the UTR / reference number and the payment date, then tap Mark Paid.",
          },
          {
            step: 4,
            title: "Undo a payment",
            description:
              "Tap the Undo button on a PAID record to revert it to PENDING if entered by mistake.",
          },
        ],
      },
      {
        id: "admin-expenses",
        title: "Step 4 — Review Expenses",
        icon: "📊",
        summary: "View and manage all society expenses recorded by the Treasurer.",
        steps: [
          {
            step: 1,
            title: "View yearly expenses",
            description:
              "Go to Expenses. Use the year navigator (← →) to switch years. The summary shows monthly totals as bars and a category breakdown.",
            path: "/dashboard/expenses",
            pathLabel: "Expenses page",
          },
          {
            step: 2,
            title: "Delete an incorrect entry",
            description:
              "Tap the trash icon on any expense card to remove it. Only Admins and Treasurers can delete expenses.",
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // SECRETARY
  // ─────────────────────────────────────────────
  {
    role: "SECRETARY",
    label: "Secretary",
    tagline: "Oversee society structure and resident records",
    color: "bg-blue-50 border-blue-200",
    textColor: "text-blue-700",
    sections: [
      {
        id: "secretary-society",
        title: "View Society Structure",
        icon: "🏢",
        summary: "Browse the full wing → floor → flat tree and see occupancy at a glance.",
        steps: [
          {
            step: 1,
            title: "Open the Society page",
            description:
              "Tap Society in the bottom nav. You'll see summary stats (wings, total flats, occupied) and the full building tree.",
            path: "/dashboard/society",
            pathLabel: "Society page",
          },
          {
            step: 2,
            title: "Read flat status",
            description:
              "Filled flat badges (dark background) are occupied; outline badges are vacant. Hover or tap a flat to see the number.",
          },
        ],
      },
      {
        id: "secretary-residents",
        title: "View Residents",
        icon: "👥",
        summary: "See all users and their flat assignments.",
        steps: [
          {
            step: 1,
            title: "Open the Residents page",
            description:
              "Tap Residents in the bottom nav. You'll see every user with their role, email, phone, and which flats they're assigned to.",
            path: "/dashboard/residents",
            pathLabel: "Residents page",
          },
          {
            step: 2,
            title: "Identify tenant history",
            description:
              "Flat assignments show whether each resident is an Owner or Tenant. Full tenant occupancy history is maintained by the system.",
          },
        ],
      },
      {
        id: "secretary-expenses",
        title: "View Expenses",
        icon: "📊",
        summary: "Monitor society spending by month and category.",
        steps: [
          {
            step: 1,
            title: "Open the Expenses page",
            description:
              "Tap Expenses in the bottom nav. Use the year navigator to review past years. The monthly bar chart and category breakdown give a quick financial overview.",
            path: "/dashboard/expenses",
            pathLabel: "Expenses page",
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // TREASURER
  // ─────────────────────────────────────────────
  {
    role: "TREASURER",
    label: "Treasurer",
    tagline: "Record expenses and track maintenance collections",
    color: "bg-amber-50 border-amber-200",
    textColor: "text-amber-700",
    sections: [
      {
        id: "treasurer-expenses",
        title: "Recording Expenses",
        icon: "🧾",
        summary: "Log every society expense with category, amount, and date.",
        steps: [
          {
            step: 1,
            title: "Open the Expenses page",
            description:
              "Tap Expenses in the bottom nav. Scroll past the summary to the Add Expense form.",
            path: "/dashboard/expenses",
            pathLabel: "Expenses page",
          },
          {
            step: 2,
            title: "Fill in the expense details",
            description:
              "Enter a descriptive title (e.g. 'April electricity bill'), select the category, enter the amount in rupees, pick the date, and add optional notes.",
          },
          {
            step: 3,
            title: "Submit",
            description:
              "Tap Add expense. It instantly appears in the list and updates the monthly bar chart and category totals.",
          },
          {
            step: 4,
            title: "Correct a mistake",
            description:
              "Tap the trash icon on any expense card to delete it. Then re-add with the correct details.",
          },
        ],
      },
      {
        id: "treasurer-maintenance",
        title: "Tracking Maintenance Payments",
        icon: "💰",
        summary: "Generate monthly records and mark collections.",
        steps: [
          {
            step: 1,
            title: "Generate records for the month",
            description:
              "Go to Maintenance. Select the month and year, then tap Generate. PENDING records appear for all flats with active charges.",
            path: "/dashboard/maintenance",
            pathLabel: "Maintenance page",
          },
          {
            step: 2,
            title: "Mark a payment as collected",
            description:
              "Find the flat, enter the UTR / reference number (from the UPI transfer) and the payment date, then tap Mark Paid.",
          },
          {
            step: 3,
            title: "Navigate between months",
            description:
              "Use the ← → arrows next to the month name to review previous months' collection status.",
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // OWNER
  // ─────────────────────────────────────────────
  {
    role: "OWNER",
    label: "Owner",
    tagline: "Track your maintenance dues and payment history",
    color: "bg-green-50 border-green-200",
    textColor: "text-green-700",
    sections: [
      {
        id: "owner-dues",
        title: "Checking Your Dues",
        icon: "🏠",
        summary: "See all pending maintenance dues and your full payment history.",
        steps: [
          {
            step: 1,
            title: "View pending dues",
            description:
              "Tap Maintenance in the bottom nav. The top card shows your total outstanding amount across all months. Each pending month is listed separately.",
            path: "/dashboard/maintenance",
            pathLabel: "Maintenance page",
          },
          {
            step: 2,
            title: "Pay via UPI",
            description:
              "Note the society UPI ID shown on the dues card. Open any UPI app (GPay, PhonePe, Paytm) and transfer the exact amount. Save the UTR / reference number from the transaction.",
          },
          {
            step: 3,
            title: "Share payment proof",
            description:
              "Share your UTR number with the Treasurer or Admin so they can mark your payment as received in the system.",
          },
          {
            step: 4,
            title: "Check payment history",
            description:
              "Scroll down on the Maintenance page to see all past payments with dates and UTR numbers.",
          },
        ],
      },
      {
        id: "owner-dashboard",
        title: "Home Dashboard",
        icon: "📋",
        summary: "Your home screen gives a quick summary of your flat and dues.",
        steps: [
          {
            step: 1,
            title: "See your flat",
            description:
              "The Dashboard shows which flat(s) you're assigned to and whether you're listed as Owner or Tenant.",
            path: "/dashboard",
            pathLabel: "Dashboard",
          },
          {
            step: 2,
            title: "Quick dues check",
            description:
              "The dues card on the Dashboard shows the total outstanding amount. Tap it to go directly to the Maintenance page.",
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // TENANT
  // ─────────────────────────────────────────────
  {
    role: "TENANT",
    label: "Tenant",
    tagline: "View dues assigned to your flat",
    color: "bg-slate-50 border-slate-200",
    textColor: "text-slate-700",
    sections: [
      {
        id: "tenant-dues",
        title: "Viewing Your Maintenance",
        icon: "🏠",
        summary: "Check pending dues and payment history for your flat.",
        steps: [
          {
            step: 1,
            title: "Open Maintenance",
            description:
              "Tap Maintenance in the bottom nav. If your society has generated records for the current month you'll see the pending amount.",
            path: "/dashboard/maintenance",
            pathLabel: "Maintenance page",
          },
          {
            step: 2,
            title: "Pay via UPI",
            description:
              "Use the society UPI ID shown on the page. Transfer the exact amount through any UPI app and save the UTR number.",
          },
          {
            step: 3,
            title: "Inform the Treasurer",
            description:
              "Share your UTR / transaction reference with the Treasurer or Admin. They will mark your payment as received.",
          },
          {
            step: 4,
            title: "Track history",
            description:
              "All past payments — with dates and UTR numbers — are listed below the pending dues on the Maintenance page.",
          },
        ],
      },
    ],
  },
];
