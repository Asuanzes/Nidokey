import { PrismaClient, PropertyType, PropertyStatus, Portal, MediaKind, MediaSource } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const p = await prisma.property.create({
    data: {
      title: "Piso reformado en el centro de Oviedo",
      description: "Piso de 3 habitaciones totalmente reformado, con chimenea y vistas al parque.",
      type: PropertyType.PISO,
      status: PropertyStatus.FOR_SALE,
      currentPrice: 24500000, // 245.000 € en céntimos
      city: "Oviedo",
      province: "Asturias",
      neighborhood: "Centro",
      rooms: 3,
      bathrooms: 2,
      builtArea: 95,
      usableArea: 88,
      floor: "4",
      hasElevator: true,
      hasFireplace: true,
      yearBuilt: 1978,
      tags: ["parque_cercano", "transporte_publico"],
      media: {
        create: [
          { kind: MediaKind.PHOTO, source: MediaSource.USER_UPLOAD, url: "https://placehold.co/800x600?text=Salon", order: 0 },
          { kind: MediaKind.PHOTO, source: MediaSource.USER_UPLOAD, url: "https://placehold.co/800x600?text=Cocina", order: 1 },
        ],
      },
      listings: {
        create: [
          {
            portal: Portal.IDEALISTA,
            url: "https://www.idealista.com/inmueble/ejemplo-1/",
            status: "ACTIVE",
            lastPrice: 24500000,
          },
        ],
      },
      priceHistory: {
        create: [
          { price: 25500000, source: Portal.IDEALISTA, observedAt: new Date("2026-03-01") },
          { price: 24900000, source: Portal.IDEALISTA, observedAt: new Date("2026-04-10") },
          { price: 24500000, source: Portal.IDEALISTA, observedAt: new Date("2026-05-01") },
        ],
      },
    },
  });

  console.log("Seed creado:", p.id);
}

main().finally(() => prisma.$disconnect());
