import { NextRequest, NextResponse } from "next/server";
import {
  computeMonthlyPnL,
  saleNetProfit,
} from "@/lib/calculations";
import { escapeCsv } from "@/lib/format";
import { itemDisplayLabel } from "@/lib/item-label";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
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
  if (isSupabaseConfigured() && !(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type") ?? "summary";
  const { year, month } = parseMonth(request.nextUrl.searchParams.get("month"));
  const monthTag = `${year}-${String(month).padStart(2, "0")}`;

  const [partners, inventory, sales, expenses] = await Promise.all([
    prisma.partner.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.inventoryItem.findMany({ orderBy: { purchaseDate: "desc" } }),
    prisma.sale.findMany({
      include: { inventoryItem: true },
      orderBy: { saleDate: "desc" },
    }),
    prisma.expense.findMany({ orderBy: { date: "desc" } }),
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
        "Sale Price",
        "Platform Fees",
        "Shipping Cost",
        "Cost Basis",
        "Net Profit",
        "Notes",
      ].join(","),
      ...monthSales.map((s) =>
        [
          escapeCsv(s.saleDate.toISOString().slice(0, 10)),
          escapeCsv(itemDisplayLabel(s.inventoryItem)),
          escapeCsv(s.salePrice),
          escapeCsv(s.platformFees),
          escapeCsv(s.shippingCost),
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
  ];

  return csvResponse(`pnl-summary-${monthTag}.csv`, rows.join("\n"));
}
