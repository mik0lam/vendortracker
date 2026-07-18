export type CardFieldInput = {
  name: string;
  setName: string | null;
  cardNumber: string | null;
  cardType: string;
  condition: string | null;
  gradeCompany: string | null;
  grade: string | null;
  certNumber: string | null;
  unitCost: number;
  quantity: number;
  notes: string | null;
};

export function parseCardFields(formData: FormData): CardFieldInput {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Card name is required");

  const cardType = String(formData.get("cardType") ?? "raw");
  const unitCost = Number(formData.get("unitCost"));
  if (Number.isNaN(unitCost) || unitCost < 0) {
    throw new Error("Invalid cost");
  }

  return {
    name,
    setName: String(formData.get("setName") ?? "").trim() || null,
    cardNumber: String(formData.get("cardNumber") ?? "").trim() || null,
    cardType,
    condition:
      cardType === "raw" ? String(formData.get("condition") ?? "NM") : null,
    gradeCompany:
      cardType === "graded"
        ? String(formData.get("gradeCompany") ?? "PSA")
        : null,
    grade:
      cardType === "graded"
        ? String(formData.get("grade") ?? "").trim() || null
        : null,
    certNumber:
      cardType === "graded"
        ? String(formData.get("certNumber") ?? "").trim() || null
        : null,
    unitCost: Math.round(unitCost * 100) / 100,
    quantity: Math.max(1, Number(formData.get("quantity") ?? 1) || 1),
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export function cardFieldsToInventoryData(
  fields: CardFieldInput,
  purchaseDate: Date,
  notes?: string | null
) {
  return {
    name: fields.name,
    setName: fields.setName,
    cardNumber: fields.cardNumber,
    cardType: fields.cardType,
    condition: fields.condition,
    gradeCompany: fields.gradeCompany,
    grade: fields.grade,
    certNumber: fields.certNumber,
    purchaseDate,
    unitCost: fields.unitCost,
    quantity: fields.quantity,
    notes: notes ?? fields.notes,
    status: "in_stock" as const,
  };
}
