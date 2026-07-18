import type { InventoryItem } from "@prisma/client";

export function itemDisplayLabel(item: InventoryItem): string {
  const parts = [item.name];
  if (item.setName) parts.push(`(${item.setName})`);
  if (item.cardType === "graded") {
    const grade = [item.gradeCompany, item.grade].filter(Boolean).join(" ");
    if (grade) parts.push(`· ${grade}`);
  } else if (item.condition) {
    parts.push(`· ${item.condition}`);
  }
  return parts.join(" ");
}
