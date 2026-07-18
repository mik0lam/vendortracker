"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  cardFieldsToInventoryData,
  parseCardFields,
} from "@/lib/card-fields";

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
  await requireUser();
  const fields = parseCardFields(formData);

  await prisma.inventoryItem.create({
    data: cardFieldsToInventoryData(
      fields,
      parseDate(formData.get("purchaseDate"))
    ),
  });

  revalidatePath("/inventory");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function deleteInventoryItem(id: string) {
  await requireUser();
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: { buyLineItem: true },
  });
  if (!item) throw new Error("Item not found");
  if (item.status === "sold") {
    throw new Error("Delete the sale first, or keep sold history intact");
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
    await tx.inventoryItem.delete({ where: { id } });
  });

  revalidatePath("/inventory");
  revalidatePath("/buy");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function createSale(formData: FormData) {
  await requireUser();
  const inventoryItemId = String(formData.get("inventoryItemId") ?? "");
  if (!inventoryItemId) throw new Error("Select an inventory item");

  const item = await prisma.inventoryItem.findUnique({
    where: { id: inventoryItemId },
  });
  if (!item) throw new Error("Item not found");
  if (item.status !== "in_stock") throw new Error("Item is already sold");

  const salePrice = parseMoney(formData.get("salePrice"));
  const platformFees = parseMoney(formData.get("platformFees") ?? "0");
  const shippingCost = parseMoney(formData.get("shippingCost") ?? "0");

  await prisma.$transaction([
    prisma.sale.create({
      data: {
        inventoryItemId,
        saleDate: parseDate(formData.get("saleDate")),
        salePrice,
        platformFees,
        shippingCost,
        notes: String(formData.get("notes") ?? "").trim() || null,
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
  await requireUser();
  const sale = await prisma.sale.findUnique({ where: { id } });
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

export async function createExpense(formData: FormData) {
  await requireUser();
  const category = String(formData.get("category") ?? "").trim();
  if (!category) throw new Error("Category is required");
  const amount = parseMoney(formData.get("amount"));
  if (amount <= 0) throw new Error("Amount must be positive");

  await prisma.expense.create({
    data: {
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
  await requireUser();
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function createContribution(formData: FormData) {
  await requireUser();
  const partnerId = String(formData.get("partnerId") ?? "");
  if (!partnerId) throw new Error("Partner is required");

  const amount = parseMoney(formData.get("amount"));
  if (amount === 0) throw new Error("Amount cannot be zero");

  const type = String(formData.get("type") ?? "in");
  const signedAmount = type === "out" ? -Math.abs(amount) : Math.abs(amount);

  await prisma.contribution.create({
    data: {
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
  await requireUser();
  const linked = await prisma.buyLineItem.findFirst({
    where: { contributionId: id },
  });
  if (linked) {
    throw new Error(
      "This contribution is linked to a show buy. Delete the buy line item instead."
    );
  }
  await prisma.contribution.delete({ where: { id } });
  revalidatePath("/contributions");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function updatePartnerName(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) throw new Error("Partner name is required");

  await prisma.partner.update({
    where: { id },
    data: { name },
  });

  revalidatePath("/contributions");
  revalidatePath("/buy");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function createBuySession(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Show name is required");

  const session = await prisma.buySession.create({
    data: {
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
  await requireUser();
  const session = await prisma.buySession.findUnique({
    where: { id },
    include: {
      items: {
        include: { inventoryItem: true },
      },
    },
  });
  if (!session) throw new Error("Session not found");

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
  await requireUser();
  const buySessionId = String(formData.get("buySessionId") ?? "");
  if (!buySessionId) throw new Error("Session is required");

  const session = await prisma.buySession.findUnique({
    where: { id: buySessionId },
  });
  if (!session) throw new Error("Show day not found");

  const paidByPartnerId = String(formData.get("paidByPartnerId") ?? "");
  if (!paidByPartnerId) throw new Error("Who paid is required");

  const allocation = String(formData.get("allocation") ?? "shared");
  const collectionPartnerId = String(
    formData.get("collectionPartnerId") ?? ""
  ).trim();

  if (allocation === "personal" && !collectionPartnerId) {
    throw new Error("Select whose collection this card is for");
  }

  const fields = parseCardFields(formData);
  const lineTotal = fields.unitCost * fields.quantity;
  const showNote = `Show buy: ${session.name}`;

  if (allocation === "shared") {
    await prisma.$transaction(async (tx) => {
      const inventoryItem = await tx.inventoryItem.create({
        data: cardFieldsToInventoryData(fields, session.date, [
          fields.notes,
          showNote,
        ]
          .filter(Boolean)
          .join(" · ")),
      });

      const contribution = await tx.contribution.create({
        data: {
          partnerId: paidByPartnerId,
          date: session.date,
          amount: lineTotal,
          note: `${showNote} · ${fields.name}`,
        },
      });

      await tx.buyLineItem.create({
        data: {
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
  } else {
    await prisma.buyLineItem.create({
      data: {
        buySessionId,
        ...fields,
        paidByPartnerId,
        allocation: "personal",
        collectionPartnerId,
      },
    });
  }

  revalidateBuy(buySessionId);
}

export async function deleteBuyLineItem(id: string) {
  await requireUser();
  const item = await prisma.buyLineItem.findUnique({
    where: { id },
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
