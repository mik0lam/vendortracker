import { Wallet } from "lucide-react";
import { deleteExpense } from "@/app/actions";
import { DeleteButton } from "@/components/DeleteButton";
import { ExpenseForm } from "@/components/ExpenseForm";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  SectionHeader,
  Table,
  TableRow,
  Td,
  Th,
} from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const expenses = await prisma.expense.findMany({
    orderBy: { date: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Business costs not tied to a single card (grading, supplies, shows)."
      />

      <Card hover className="mb-8">
        <SectionHeader title="Add expense" description="Log supplies, grading, show fees, etc." />
        <ExpenseForm />
      </Card>

      <SectionHeader
        title="Expense history"
        description={`${expenses.length} expense${expenses.length === 1 ? "" : "s"} logged`}
      />

      {expenses.length === 0 ? (
        <EmptyState
          message="No expenses logged yet."
          icon={<Wallet className="h-5 w-5" />}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Category</Th>
              <Th>Amount</Th>
              <Th>Note</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <Td className="text-muted">{formatDate(expense.date)}</Td>
                <Td>
                  <Badge variant="warning">{expense.category}</Badge>
                </Td>
                <Td className="font-semibold tabular-nums">
                  {formatCurrency(expense.amount)}
                </Td>
                <Td className="max-w-xs truncate text-muted">
                  {expense.note ?? "—"}
                </Td>
                <Td>
                  <DeleteButton
                    confirmMessage="Delete this expense?"
                    action={deleteExpense.bind(null, expense.id)}
                  />
                </Td>
              </TableRow>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
