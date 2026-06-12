import { after } from "next/server";
import type { FoodOrderActor, FoodOrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const TRANSITIONS: Partial<Record<FoodOrderStatus, readonly FoodOrderStatus[]>> = {
  CREATED: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["IN_DELIVERY"],
  IN_DELIVERY: ["DELIVERED"],
};

export class FoodTransitionConflict extends Error {
  status = 409;
  constructor() {
    super("El pedido ya ha cambiado de estado");
  }
}

export type TransitionEffect = (orderId: string, to: FoodOrderStatus) => Promise<void> | void;

export async function transitionFoodOrder(args: {
  id: string;
  from: FoodOrderStatus;
  to: FoodOrderStatus;
  actorType: FoodOrderActor;
  actorId?: string | null;
  data?: Prisma.FoodOrderUpdateManyMutationInput;
  meta?: Prisma.InputJsonValue;
  effect?: TransitionEffect;
}) {
  const allowed = TRANSITIONS[args.from] ?? [];
  if (!allowed.includes(args.to)) throw new FoodTransitionConflict();

  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.foodOrder.updateMany({
      where: { id: args.id, status: args.from },
      data: { ...(args.data ?? {}), status: args.to },
    });
    if (updated.count === 0) throw new FoodTransitionConflict();
    await tx.foodOrderEvent.create({
      data: {
        orderId: args.id,
        fromStatus: args.from,
        toStatus: args.to,
        actorType: args.actorType,
        actorId: args.actorId ?? null,
        meta: args.meta ?? undefined,
      },
    });
    return tx.foodOrder.findUniqueOrThrow({
      where: { id: args.id },
      include: { payment: true, restaurant: true },
    });
  });

  if (args.effect) {
    after(async () => args.effect!(args.id, args.to));
  }
  return order;
}

export async function createFoodOrderEvent(
  tx: Prisma.TransactionClient,
  data: {
    orderId: string;
    fromStatus?: FoodOrderStatus | null;
    toStatus: FoodOrderStatus;
    actorType: FoodOrderActor;
    actorId?: string | null;
    meta?: Prisma.InputJsonValue;
  }
) {
  return tx.foodOrderEvent.create({
    data: {
      orderId: data.orderId,
      fromStatus: data.fromStatus ?? null,
      toStatus: data.toStatus,
      actorType: data.actorType,
      actorId: data.actorId ?? null,
      meta: data.meta ?? undefined,
    },
  });
}
