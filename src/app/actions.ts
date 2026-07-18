"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOwnerId } from "@/lib/auth";
import {
  cardFieldsToInventoryData,
  parseCardFields,
} from "@/lib/card-fields";
import { allocateTradeCosts, computeTradeBasis } from "@/lib/trade";

function parseMoney(value: FormDataEntryValue | null): number {
  const n = Number(value);
  if (Number.isNaN(n)) throw new Error("Invalid amount");
  return Math.round(n * 100) / 100;
}

function parseDate(value: FormDataEntryValue | null): Date {
  if (!value || typeof value !== "string") throw new Error("Date is required");
  const d = new Date(value + "T12:00:00");
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return d;
}

function revalidateBuy(sessionId?: string) {
  revalidatePath("/buy");
  revalidatePath("/inventory");
  revalidatePath("/contributions");
  revalidatePath("/");
  revalidatePath("/reports");
  if (sessionId) revalidatePath(`/buy/${sessionId}`);
}

export async function createInventoryItem(formData: FormData) {
  const ownerId = await requireOwnerId();
  const fields = parseCardFields(formData);
  const paidByRaw = String(formData.get("paidByPartnerId") ?? "").trim();
  const paidByPartnerId = paidByRaw || null;
  const purchaseDate = parseDate(formData.get("purchaseDate"));

  if (paidByPartnerId) {
    const partner = await prisma.partner.findFirst({
      where: { id: paidByPartnerId, ownerId },
    });
    if (!partner) throw new Error("Select who paid for the card");
  }

  await prisma.$transaction(async (tx) => {
    const contribution = paidByPartnerId
      ? await tx.contribution.create({
          data: {
            ownerId,
            partnerId: paidByPartnerId,
            date: purchaseDate,
            amount: fields.unitCost * fields.quantity,
            note: `Inventory purchase · ${fields.name}`,
          },
        })
      : null;

    await tx.inventoryItem.create({
      data: {
        ...cardFieldsToInventoryData(fields, purchaseDate),
        ownerId,
        paidByPartnerId,
        purchaseContributionId: contribution?.id ?? null,
      },
    });
  });

  revalidatePath("/inventory");
  revalidatePath("/contributions");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function deleteInventoryItem(id: string) {
  const ownerId = await requireOwnerId();
  const item = await prisma.inventoryItem.findFirst({
    where: { id, ownerId },
    include: {
      buyLineItem: true,
      purchaseContribution: true,
      tradeInItem: true,
      tradeOutItem: true,
    },
  });
  if (!item) throw new Error("Item not found");
  if (item.tradeInItem || item.tradeOutItem) {
    throw new Error(
      "This card is part of a trade. Reverse the trade on the Trades page first."
    );
  }
  if (item.status !== "in_stock") {
    throw new Error(
      item.status === "sold"
        ? "Delete the sale first, or keep sold history intact"
        : item.status === "traded"
          ? "Reverse the trade first"
          : "Reverse the personal collection withdrawal first"
    );
  }

  await prisma.$transaction(async (tx) => {
    if (item.buyLineItem) {
      await tx.buyLineItem.update({
        where: { id: item.buyLineItem.id },
        data: { inventoryItemId: null, contributionId: null },
      });
      if (item.buyLineItem.contributionId) {
        await tx.contribution.delete({
          where: { id: item.buyLineItem.contributionId },
        });
      }
    }
    if (item.purchaseContributionId) {
      await tx.inventoryItem.update({
        where: { id },
        data: { purchaseContributionId: null },
      });
      await tx.contribution.delete({
        where: { id: item.purchaseContributionId },
      });
    }
    await tx.inventoryItem.delete({ where: { id } });
  });

  revalidatePath("/inventory");
  revalidatePath("/buy");
  revalidatePath("/contributions");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function createSale(formData: FormData) {
  const ownerId = await requireOwnerId();
  const inventoryItemId = String(formData.get("inventoryItemId") ?? "");
  if (!inventoryItemId) throw new Error("Select an inventory item");

  const item = await prisma.inventoryItem.findFirst({
    where: { id: inventoryItemId, ownerId },
  });
  if (!item) throw new Error("Item not found");
  if (item.status !== "in_stock") throw new Error("Item is already sold");

  const salePrice = parseMoney(formData.get("salePrice"));
  const platformFees = parseMoney(formData.get("platformFees") ?? "0");
  const shippingCost = parseMoney(formData.get("shippingCost") ?? "0");
  const receivedRaw = String(formData.get("receivedByPartnerId") ?? "").trim();
  const receivedByPartnerId = receivedRaw || null;

  if (receivedByPartnerId) {
    const partner = await prisma.partner.findFirst({
      where: { id: receivedByPartnerId, ownerId },
    });
    if (!partner) throw new Error("Select who received payment");
  }

  await prisma.$transaction([
    prisma.sale.create({
      data: {
        ownerId,
        inventoryItemId,
        saleDate: parseDate(formData.get("saleDate")),
        salePrice,
        platformFees,
        shippingCost,
        notes: String(formData.get("notes") ?? "").trim() || null,
        receivedByPartnerId,
      },
    }),
    prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { status: "sold" },
    }),
  ]);

  revalidatePath("/inventory");
  revalidatePath("/sales");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function deleteSale(id: string) {
  const ownerId = await requireOwnerId();
  const sale = await prisma.sale.findFirst({ where: { id, ownerId } });
  if (!sale) throw new Error("Sale not found");

  await prisma.$transaction([
    prisma.sale.delete({ where: { id } }),
    prisma.inventoryItem.update({
      where: { id: sale.inventoryItemId },
      data: { status: "in_stock" },
    }),
  ]);

  revalidatePath("/inventory");
  revalidatePath("/sales");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function createCollectionWithdrawal(formData: FormData) {
  const ownerId = await requireOwnerId();
  const inventoryItemId = String(formData.get("inventoryItemId") ?? "");
  const takenByPartnerId = String(formData.get("takenByPartnerId") ?? "");
  if (!inventoryItemId) throw new Error("Select an inventory item");
  if (!takenByPartnerId) throw new Error("Select who is taking the card");

  const [item, partner] = await Promise.all([
    prisma.inventoryItem.findFirst({ where: { id: inventoryItemId, ownerId } }),
    prisma.partner.findFirst({ where: { id: takenByPartnerId, ownerId } }),
  ]);
  if (!item) throw new Error("Item not found");
  if (item.status !== "in_stock") {
    throw new Error("Item is no longer in stock");
  }
  if (!partner) throw new Error("Partner not found");

  const costBasis = item.unitCost * item.quantity;
  await prisma.$transaction([
    prisma.collectionWithdrawal.create({
      data: {
        ownerId,
        inventoryItemId,
        takenByPartnerId,
        date: parseDate(formData.get("date")),
        costBasis,
        notes: String(formData.get("notes") ?? "").trim() || null,
      },
    }),
    prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { status: "personal" },
    }),
  ]);

  revalidatePath("/inventory");
  revalidatePath("/sales");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function deleteCollectionWithdrawal(id: string) {
  const ownerId = await requireOwnerId();
  const withdrawal = await prisma.collectionWithdrawal.findFirst({
    where: { id, ownerId },
  });
  if (!withdrawal) throw new Error("Collection withdrawal not found");

  await prisma.$transaction([
    prisma.collectionWithdrawal.delete({ where: { id } }),
    prisma.inventoryItem.update({
      where: { id: withdrawal.inventoryItemId },
      data: { status: "in_stock" },
    }),
  ]);

  revalidatePath("/inventory");
  revalidatePath("/sales");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function createExpense(formData: FormData) {
  const ownerId = await requireOwnerId();
  const category = String(formData.get("category") ?? "").trim();
  if (!category) throw new Error("Category is required");
  const amount = parseMoney(formData.get("amount"));
  if (amount <= 0) throw new Error("Amount must be positive");

  await prisma.expense.create({
    data: {
      ownerId,
      date: parseDate(formData.get("date")),
      category,
      amount,
      note: String(formData.get("note") ?? "").trim() || null,
    },
  });

  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function deleteExpense(id: string) {
  const ownerId = await requireOwnerId();
  const { count } = await prisma.expense.deleteMany({
    where: { id, ownerId },
  });
  if (count === 0) throw new Error("Expense not found");
  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function createContribution(formData: FormData) {
  const ownerId = await requireOwnerId();
  const partnerId = String(formData.get("partnerId") ?? "");
  if (!partnerId) throw new Error("Partner is required");

  const partner = await prisma.partner.findFirst({
    where: { id: partnerId, ownerId },
  });
  if (!partner) throw new Error("Partner not found");

  const amount = parseMoney(formData.get("amount"));
  if (amount === 0) throw new Error("Amount cannot be zero");

  const type = String(formData.get("type") ?? "in");
  const signedAmount = type === "out" ? -Math.abs(amount) : Math.abs(amount);

  await prisma.contribution.create({
    data: {
      ownerId,
      partnerId,
      date: parseDate(formData.get("date")),
      amount: signedAmount,
      note: String(formData.get("note") ?? "").trim() || null,
    },
  });

  revalidatePath("/contributions");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function deleteContribution(id: string) {
  const ownerId = await requireOwnerId();
  const contribution = await prisma.contribution.findFirst({
    where: { id, ownerId },
  });
  if (!contribution) throw new Error("Contribution not found");
  const linkedBuy = await prisma.buyLineItem.findFirst({
    where: { contributionId: id },
  });
  if (linkedBuy) {
    throw new Error(
      "This contribution is linked to a show buy. Delete the buy line item instead."
    );
  }
  const linkedTrade = await prisma.trade.findFirst({
    where: { cashPaidContributionId: id },
  });
  if (linkedTrade) {
    throw new Error(
      "This contribution is linked to a trade. Reverse the trade instead."
    );
  }
  const linkedInventory = await prisma.inventoryItem.findFirst({
    where: { purchaseContributionId: id },
  });
  if (linkedInventory) {
    throw new Error(
      "This contribution is linked to an inventory purchase. Delete the purchase instead."
    );
  }
  await prisma.contribution.delete({ where: { id } });
  revalidatePath("/contributions");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function updatePartnerName(formData: FormData) {
  const ownerId = await requireOwnerId();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) throw new Error("Partner name is required");

  const { count } = await prisma.partner.updateMany({
    where: { id, ownerId },
    data: { name },
  });
  if (count === 0) throw new Error("Partner not found");

  revalidatePath("/contributions");
  revalidatePath("/buy");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function createBuySession(formData: FormData) {
  const ownerId = await requireOwnerId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Show name is required");

  const session = await prisma.buySession.create({
    data: {
      ownerId,
      name,
      date: parseDate(formData.get("date")),
      location: String(formData.get("location") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });

  revalidateBuy();
  return session.id;
}

export async function deleteBuySession(id: string) {
  const ownerId = await requireOwnerId();
  const session = await prisma.buySession.findFirst({
    where: { id, ownerId },
    include: {
      trades: { select: { id: true } },
      items: {
        include: { inventoryItem: true },
      },
    },
  });
  if (!session) throw new Error("Session not found");
  if (session.trades.length > 0) {
    throw new Error(
      "Reverse this show's trades before deleting the show day."
    );
  }

  for (const item of session.items) {
    if (item.inventoryItem?.status === "sold") {
      throw new Error(
        `Cannot delete session: "${item.name}" was sold from shared inventory.`
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const item of session.items) {
      if (item.contributionId) {
        await tx.contribution.delete({ where: { id: item.contributionId } });
      }
      if (item.inventoryItemId) {
        await tx.inventoryItem.delete({ where: { id: item.inventoryItemId } });
      }
    }
    await tx.buySession.delete({ where: { id } });
  });

  revalidateBuy();
  redirect("/buy");
}

export async function addBuyLineItem(formData: FormData) {
  const ownerId = await requireOwnerId();
  const buySessionId = String(formData.get("buySessionId") ?? "");
  if (!buySessionId) throw new Error("Session is required");

  const session = await prisma.buySession.findFirst({
    where: { id: buySessionId, ownerId },
  });
  if (!session) throw new Error("Show day not found");

  const paidByPartnerId = String(formData.get("paidByPartnerId") ?? "");
  if (!paidByPartnerId) throw new Error("Who paid is required");

  const partner = await prisma.partner.findFirst({
    where: { id: paidByPartnerId, ownerId },
  });
  if (!partner) throw new Error("Partner not found");

  const fields = parseCardFields(formData);
  const lineTotal = fields.unitCost * fields.quantity;
  const showNote = `Show buy: ${session.name}`;

  await prisma.$transaction(async (tx) => {
    const inventoryItem = await tx.inventoryItem.create({
      data: {
        ...cardFieldsToInventoryData(
          fields,
          session.date,
          [fields.notes, showNote].filter(Boolean).join(" · ")
        ),
        ownerId,
        paidByPartnerId,
      },
    });

    const contribution = await tx.contribution.create({
      data: {
        ownerId,
        partnerId: paidByPartnerId,
        date: session.date,
        amount: lineTotal,
        note: `${showNote} · ${fields.name}`,
      },
    });

    await tx.buyLineItem.create({
      data: {
        ownerId,
        buySessionId,
        ...fields,
        paidByPartnerId,
        allocation: "shared",
        collectionPartnerId: null,
        inventoryItemId: inventoryItem.id,
        contributionId: contribution.id,
      },
    });
  });

  revalidateBuy(buySessionId);
}

export async function deleteBuyLineItem(id: string) {
  const ownerId = await requireOwnerId();
  const item = await prisma.buyLineItem.findFirst({
    where: { id, ownerId },
    include: { inventoryItem: true },
  });
  if (!item) throw new Error("Item not found");

  if (item.inventoryItem?.status === "sold") {
    throw new Error("This card was already sold from shared inventory.");
  }

  await prisma.$transaction(async (tx) => {
    if (item.contributionId) {
      await tx.contribution.delete({ where: { id: item.contributionId } });
    }
    if (item.inventoryItemId) {
      await tx.inventoryItem.delete({ where: { id: item.inventoryItemId } });
    }
    await tx.buyLineItem.delete({ where: { id } });
  });

  revalidateBuy(item.buySessionId);
}

function revalidateTrade(buySessionId?: string | null) {
  revalidatePath("/trades");
  revalidatePath("/inventory");
  revalidatePath("/contributions");
  revalidatePath("/");
  revalidatePath("/reports");
  if (buySessionId) revalidatePath(`/buy/${buySessionId}`);
}

type IncomingTradeCardPayload = {
  name: string;
  setName?: string | null;
  cardNumber?: string | null;
  cardType?: string;
  condition?: string | null;
  gradeCompany?: string | null;
  grade?: string | null;
  certNumber?: string | null;
  tcgplayerUrl?: string | null;
  tcgplayerProductId?: number | null;
  tcgplayerGroupId?: number | null;
  imageUrl?: string | null;
  marketPrice?: number | null;
  language?: string | null;
  notes?: string | null;
};

function parseIncomingTradeCards(raw: FormDataEntryValue | null): IncomingTradeCardPayload[] {
  if (!raw || typeof raw !== "string") {
    throw new Error("Add at least one incoming card");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid incoming cards payload");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Add at least one incoming card");
  }
  return parsed.map((card, index) => {
    if (!card || typeof card !== "object") {
      throw new Error(`Incoming card ${index + 1} is invalid`);
    }
    const c = card as IncomingTradeCardPayload;
    const name = String(c.name ?? "").trim();
    if (!name) throw new Error(`Incoming card ${index + 1} needs a name`);
    return {
      ...c,
      name,
      cardType: c.cardType === "graded" ? "graded" : "raw",
      language: c.language === "ja" ? "ja" : "en",
      marketPrice:
        c.marketPrice != null && !Number.isNaN(Number(c.marketPrice))
          ? Math.max(0, Math.round(Number(c.marketPrice) * 100) / 100)
          : null,
    };
  });
}

export async function createTrade(formData: FormData) {
  const ownerId = await requireOwnerId();
  const buySessionId =
    String(formData.get("buySessionId") ?? "").trim() || null;

  const outgoingRaw = String(formData.get("outgoingIds") ?? "").trim();
  let outgoingIds: string[] = [];
  try {
    const parsed = JSON.parse(outgoingRaw);
    if (Array.isArray(parsed)) {
      outgoingIds = parsed.map(String).filter(Boolean);
    }
  } catch {
    outgoingIds = outgoingRaw
      ? outgoingRaw.split(",").map((id) => id.trim()).filter(Boolean)
      : [];
  }
  if (outgoingIds.length === 0) {
    throw new Error("Select at least one outgoing card");
  }

  const incomingCards = parseIncomingTradeCards(formData.get("incomingCards"));
  const cashPaid = parseMoney(formData.get("cashPaid") ?? "0");
  const cashReceived = parseMoney(formData.get("cashReceived") ?? "0");
  if (cashPaid < 0 || cashReceived < 0) {
    throw new Error("Cash amounts cannot be negative");
  }

  const cashPaidByRaw = String(formData.get("cashPaidByPartnerId") ?? "").trim();
  const cashReceivedByRaw = String(
    formData.get("cashReceivedByPartnerId") ?? ""
  ).trim();
  const cashPaidByPartnerId =
    cashPaid > 0 && cashPaidByRaw ? cashPaidByRaw : null;
  const cashReceivedByPartnerId =
    cashReceived > 0 && cashReceivedByRaw ? cashReceivedByRaw : null;

  const tradeDate = parseDate(formData.get("date"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await prisma.$transaction(async (tx) => {
    if (buySessionId) {
      const session = await tx.buySession.findFirst({
        where: { id: buySessionId, ownerId },
        select: { id: true },
      });
      if (!session) throw new Error("Show day not found");
    }

    const outgoing = await tx.inventoryItem.findMany({
      where: { id: { in: outgoingIds }, ownerId },
    });
    if (outgoing.length !== outgoingIds.length) {
      throw new Error("One or more outgoing cards were not found");
    }
    for (const item of outgoing) {
      if (item.status !== "in_stock") {
        throw new Error(`"${item.name}" is not in stock`);
      }
    }

    if (cashPaidByPartnerId) {
      const partner = await tx.partner.findFirst({
        where: { id: cashPaidByPartnerId, ownerId },
      });
      if (!partner) throw new Error("Select who paid the cash");
    }
    if (cashReceivedByPartnerId) {
      const partner = await tx.partner.findFirst({
        where: { id: cashReceivedByPartnerId, ownerId },
      });
      if (!partner) throw new Error("Select who received the cash");
    }

    const outgoingCosts = outgoing.map((i) => i.unitCost * i.quantity);
    const totalBasis = computeTradeBasis(outgoingCosts, cashPaid, cashReceived);
    const marketPrices = incomingCards.map((c) => c.marketPrice ?? 0);
    const allocated = allocateTradeCosts(totalBasis, marketPrices);

    const outNames = outgoing.map((i) => i.name).join(", ");
    const contribution =
      cashPaid > 0 && cashPaidByPartnerId
        ? await tx.contribution.create({
            data: {
              ownerId,
              partnerId: cashPaidByPartnerId,
              date: tradeDate,
              amount: cashPaid,
              note: `Trade cash paid · for ${outNames}`,
            },
          })
        : null;

    const trade = await tx.trade.create({
      data: {
        ownerId,
        buySessionId,
        date: tradeDate,
        notes,
        cashPaid,
        cashReceived,
        cashPaidByPartnerId,
        cashReceivedByPartnerId,
        cashPaidContributionId: contribution?.id ?? null,
      },
    });

    for (const item of outgoing) {
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { status: "traded" },
      });
      await tx.tradeOutItem.create({
        data: {
          tradeId: trade.id,
          inventoryItemId: item.id,
        },
      });
    }

    for (let i = 0; i < incomingCards.length; i++) {
      const card = incomingCards[i];
      const unitCost = allocated[i] ?? 0;
      const cardType = card.cardType === "graded" ? "graded" : "raw";
      const inventoryItem = await tx.inventoryItem.create({
        data: {
          ownerId,
          name: card.name,
          setName: card.setName?.trim() || null,
          cardNumber: card.cardNumber?.trim() || null,
          cardType,
          condition:
            cardType === "raw" ? card.condition?.trim() || "NM" : null,
          gradeCompany:
            cardType === "graded"
              ? card.gradeCompany?.trim() || "PSA"
              : null,
          grade: cardType === "graded" ? card.grade?.trim() || null : null,
          certNumber:
            cardType === "graded" ? card.certNumber?.trim() || null : null,
          purchaseDate: tradeDate,
          unitCost,
          quantity: 1,
          status: "in_stock",
          notes: card.notes?.trim() || null,
          tcgplayerUrl: card.tcgplayerUrl || null,
          tcgplayerProductId: card.tcgplayerProductId ?? null,
          tcgplayerGroupId: card.tcgplayerGroupId ?? null,
          imageUrl: card.imageUrl || null,
          marketPrice: card.marketPrice ?? null,
          marketPriceUpdatedAt: card.marketPrice != null ? new Date() : null,
          language: card.language === "ja" ? "ja" : "en",
          paidByPartnerId: null,
        },
      });
      await tx.tradeInItem.create({
        data: {
          tradeId: trade.id,
          inventoryItemId: inventoryItem.id,
          marketPriceUsed: card.marketPrice ?? 0,
          allocatedCost: unitCost,
        },
      });
    }
  });

  revalidateTrade(buySessionId);
}

export async function deleteTrade(id: string) {
  const ownerId = await requireOwnerId();
  const trade = await prisma.trade.findFirst({
    where: { id, ownerId },
    include: {
      outItems: { include: { inventoryItem: true } },
      inItems: { include: { inventoryItem: true } },
    },
  });
  if (!trade) throw new Error("Trade not found");

  for (const inItem of trade.inItems) {
    if (inItem.inventoryItem.status !== "in_stock") {
      throw new Error(
        `Cannot reverse: "${inItem.inventoryItem.name}" is no longer in stock (${inItem.inventoryItem.status})`
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const inItem of trade.inItems) {
      await tx.tradeInItem.delete({ where: { id: inItem.id } });
      await tx.inventoryItem.delete({
        where: { id: inItem.inventoryItemId },
      });
    }

    for (const outItem of trade.outItems) {
      await tx.tradeOutItem.delete({ where: { id: outItem.id } });
      await tx.inventoryItem.update({
        where: { id: outItem.inventoryItemId },
        data: { status: "in_stock" },
      });
    }

    const contributionId = trade.cashPaidContributionId;
    await tx.trade.delete({ where: { id } });
    if (contributionId) {
      await tx.contribution.delete({ where: { id: contributionId } });
    }
  });

  revalidateTrade(trade.buySessionId);
}
