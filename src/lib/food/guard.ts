import { prisma } from "@/lib/db";

export async function getStaffOrNull(userId: string, restaurantId: string) {
  return prisma.restaurantStaff.findUnique({
    where: { restaurantId_userId: { restaurantId, userId } },
    include: { restaurant: true },
  });
}

export async function getCourierOrNull(userId: string) {
  return prisma.courierProfile.findUnique({
    where: { userId },
  });
}

export async function getOrderForViewerOrNull(userId: string, orderId: string) {
  const order = await prisma.foodOrder.findUnique({
    where: { id: orderId },
    include: {
      restaurant: { include: { staff: { select: { userId: true, role: true } } } },
      items: { orderBy: { id: "asc" } },
      payment: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) return null;
  if (order.customerId === userId) return order;
  if (order.courierId === userId) return order;
  if (order.restaurant.staff.some((s) => s.userId === userId)) return order;
  return null;
}

export function staffCanManageMenu(role: string): boolean {
  return role === "OWNER" || role === "MANAGER";
}
