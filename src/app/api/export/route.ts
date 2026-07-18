import { NextRequest, NextResponse } from "next/server";
import {
  computeMonthlyPnL,
  receiverLabel,
  saleNetProceeds,
  saleNetProfit,
} from "@/lib/calculations";
import { escapeCsv } from "@/lib/format";
import { itemDisplayLabel } from "@/lib/item-label";
import { prisma } from "@/lib/db";
import { getCurrentUser, LOCAL_OWNER_ID } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

function parseMonth(value: string | null): { year: number; month: number } {
  const fallback = new Date();
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return { year: fallback.getFullYear(), month: fallback.getMonth() + 1 };
  }
  const [y, m] = value.split("-").map(Number);
  return { year: y, month: m };
}

function csvResponse(filename: string, body: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (isSupabaseConfigured() && !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = user?.id ?? LOCAL_OWNER_ID;

  const type = request.nextUrl.searchParams.get("type") ?? "summary";
  const { year, month } = parseMonth(request.nextUrl.searchParams.get("month"));
  const monthTag = `${year}-${String(month).padStart(2, "0")}`;

  const [partners, inventory, sales, expenses, collectionWithdrawals] =
    await Promise.all([
    prisma.partner.findMany({
      where: { ownerId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.inventoryItem.findMany({
      where: { ownerId },
      orderBy: { purchaseDate: "desc" },
    }),
    prisma.sale.findMany({
      where: { ownerId },
      include: { inventoryItem: true, receivedBy: true },
      orderBy: { saleDate: "desc" },
    }),
    prisma.expense.findMany({ where: { ownerId }, orderBy: { date: "desc" } }),
    prisma.collectionWithdrawal.findMany({
      where: { ownerId },
      include: { inventoryItem: true, takenBy: true },
      orderBy: { date: "desc" },
    }),
  ]);

  if (type === "sales") {
    const monthSales = sales.filter((s) => {
      const d = new Date(s.saleDate);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
    const rows = [
      [
        "Sale Date",
        "Card",
        "Received By",
        "Sale Price",
        "Platform Fees",
        "Shipping Cost",
        "Net Proceeds",
        "Cost Basis",
        "Net Profit",
        "Notes",
      ].join(","),
      ...monthSales.map((s) =>
        [
          escapeCsv(s.saleDate.toISOString().slice(0, 10)),
          escapeCsv(itemDisplayLabel(s.inventoryItem)),
          escapeCsv(receiverLabel(s)),
          escapeCsv(s.salePrice),
          escapeCsv(s.platformFees),
          escapeCsv(s.shippingCost),
          escapeCsv(saleNetProceeds(s)),
          escapeCsv(s.inventoryItem.unitCost * s.inventoryItem.quantity),
          escapeCsv(saleNetProfit(s)),
          escapeCsv(s.notes),
        ].join(",")
      ),
    ];
    return csvResponse(`sales-${monthTag}.csv`, rows.join("\n"));
  }

  if (type === "expenses") {
    const monthExpenses = expenses.filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
    const rows = [
      ["Date", "Category", "Amount", "Note"].join(","),
      ...monthExpenses.map((e) =>
        [
          escapeCsv(e.date.toISOString().slice(0, 10)),
          escapeCsv(e.category),
          escapeCsv(e.amount),
          escapeCsv(e.note),
        ].join(",")
      ),
    ];
    return csvResponse(`expenses-${monthTag}.csv`, rows.join("\n"));
  }

  if (type === "inventory") {
    const rows = [
      [
        "Name",
        "Set",
        "Card Number",
        "Type",
        "Condition/Grade",
        "Cert",
        "Purchase Date",
        "Unit Cost",
        "Quantity",
        "Status",
        "Notes",
      ].join(","),
      ...inventory.map((i) =>
        [
          escapeCsv(i.name),
          escapeCsv(i.setName),
          escapeCsv(i.cardNumber),
          escapeCsv(i.cardType),
          escapeCsv(
            i.cardType === "graded"
              ? `${i.gradeCompany ?? ""} ${i.grade ?? ""}`.trim()
              : i.condition
          ),
          escapeCsv(i.certNumber),
          escapeCsv(i.purchaseDate.toISOString().slice(0, 10)),
          escapeCsv(i.unitCost),
          escapeCsv(i.quantity),
          escapeCsv(i.status),
          escapeCsv(i.notes),
        ].join(",")
      ),
    ];
    return csvResponse("inventory.csv", rows.join("\n"));
  }

  const pnl = computeMonthlyPnL(year, month, sales, expenses, partners);
  const rows = [
    ["Section", "Label", "Amount"].join(","),
    ["P&L", "Revenue", escapeCsv(pnl.revenue)].join(","),
    ["P&L", "COGS", escapeCsv(pnl.cogs)].join(","),
    ["P&L", "Gross Profit", escapeCsv(pnl.grossProfit)].join(","),
    ["P&L", "Total Expenses", escapeCsv(pnl.totalExpenses)].join(","),
    ["P&L", "Net Profit", escapeCsv(pnl.netProfit)].join(","),
    ...pnl.expensesByCategory.map((row) =>
      ["Expense Category", escapeCsv(row.category), escapeCsv(row.amount)].join(
        ","
      )
    ),
    ...pnl.partnerAllocation.map((row) =>
      [
        "Partner Allocation",
        escapeCsv(row.partner.name),
        escapeCsv(row.amount),
      ].join(",")
    ),
    ...pnl.sales.map((s) =>
      [
        "Sale Detail",
        escapeCsv(itemDisplayLabel(s.inventoryItem)),
        escapeCsv(s.salePrice),
      ].join(",")
    ),
    ...pnl.expenses.map((e) =>
      ["Expense Detail", escapeCsv(e.category), escapeCsv(e.amount)].join(",")
    ),
    ...collectionWithdrawals.map((withdrawal) =>
      [
        "Collection Withdrawal",
        escapeCsv(
          `${itemDisplayLabel(withdrawal.inventoryItem)} → ${withdrawal.takenBy.name}`
        ),
        escapeCsv(withdrawal.costBasis),
      ].join(",")
    ),
  ];

  return csvResponse(`pnl-summary-${monthTag}.csv`, rows.join("\n"));
}
