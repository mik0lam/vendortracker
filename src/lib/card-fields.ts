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
  tcgplayerUrl: string | null;
  tcgplayerProductId: number | null;
  tcgplayerGroupId: number | null;
  imageUrl: string | null;
  marketPrice: number | null;
  language: "en" | "ja";
};

function parseOptionalUrl(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Invalid TCGplayer URL");
    }
    return url.toString();
  } catch {
    throw new Error("Invalid TCGplayer URL");
  }
}

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function parseOptionalMoney(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

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
    tcgplayerUrl: parseOptionalUrl(formData.get("tcgplayerUrl")),
    tcgplayerProductId: parseOptionalInt(formData.get("tcgplayerProductId")),
    tcgplayerGroupId: parseOptionalInt(formData.get("tcgplayerGroupId")),
    imageUrl: parseOptionalUrl(formData.get("imageUrl")),
    marketPrice: parseOptionalMoney(formData.get("marketPrice")),
    language: String(formData.get("language") ?? "en") === "ja" ? "ja" : "en",
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
    tcgplayerUrl: fields.tcgplayerUrl,
    tcgplayerProductId: fields.tcgplayerProductId,
    tcgplayerGroupId: fields.tcgplayerGroupId,
    imageUrl: fields.imageUrl,
    marketPrice: fields.marketPrice,
    marketPriceUpdatedAt: fields.marketPrice != null ? new Date() : null,
    language: fields.language,
    status: "in_stock" as const,
  };
}
