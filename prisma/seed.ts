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

  const restaurants = [
    {
      slug: "casa-pelayo",
      name: "Casa Pelayo",
      description: "Cocina asturiana de diario",
      imageUrl: "https://placehold.co/800x500?text=Casa+Pelayo",
      address: "Calle Uría 12",
      city: "Oviedo",
      postalCode: "33003",
      latitude: 43.3623,
      longitude: -5.8494,
      deliveryFeeCents: 250,
      minOrderCents: 1200,
      categories: [
        { name: "Platos", items: [
          { name: "Fabada asturiana", description: "Ración caliente con compango", priceCents: 1250 },
          { name: "Cachopo clásico", description: "Ternera, jamón y queso", priceCents: 1650 },
        ] },
        { name: "Postres", items: [{ name: "Arroz con leche", description: "Requemado", priceCents: 450 }] },
      ],
    },
    {
      slug: "pizza-naranco",
      name: "Pizza Naranco",
      description: "Pizzas finas y entrantes",
      imageUrl: "https://placehold.co/800x500?text=Pizza+Naranco",
      address: "Avenida de Galicia 35",
      city: "Oviedo",
      postalCode: "33005",
      latitude: 43.3658,
      longitude: -5.8612,
      deliveryFeeCents: 190,
      minOrderCents: 1000,
      categories: [
        { name: "Pizzas", items: [
          { name: "Margarita", description: "Tomate, mozzarella y albahaca", priceCents: 950 },
          { name: "Picante", description: "Pepperoni y guindilla", priceCents: 1150 },
        ] },
      ],
    },
    {
      slug: "sushi-cimadevilla",
      name: "Sushi Cimadevilla",
      description: "Sushi y bowls",
      imageUrl: "https://placehold.co/800x500?text=Sushi+Cimadevilla",
      address: "Calle Corrida 18",
      city: "Gijón",
      postalCode: "33206",
      latitude: 43.5436,
      longitude: -5.6635,
      deliveryFeeCents: 290,
      minOrderCents: 1500,
      categories: [
        { name: "Sushi", items: [
          { name: "Combo 16 piezas", description: "Maki, nigiri y uramaki", priceCents: 1850 },
          { name: "Poke salmón", description: "Arroz, salmón, edamame y aguacate", priceCents: 1290 },
        ] },
      ],
    },
  ];

  for (const r of restaurants) {
    const restaurant = await prisma.restaurant.upsert({
      where: { slug: r.slug },
      update: {
        name: r.name,
        description: r.description,
        imageUrl: r.imageUrl,
        address: r.address,
        city: r.city,
        postalCode: r.postalCode,
        latitude: r.latitude,
        longitude: r.longitude,
        deliveryFeeCents: r.deliveryFeeCents,
        minOrderCents: r.minOrderCents,
        active: true,
        isOpen: true,
      },
      create: {
        slug: r.slug,
        name: r.name,
        description: r.description,
        imageUrl: r.imageUrl,
        address: r.address,
        city: r.city,
        postalCode: r.postalCode,
        latitude: r.latitude,
        longitude: r.longitude,
        deliveryFeeCents: r.deliveryFeeCents,
        minOrderCents: r.minOrderCents,
      },
    });
    for (const [catIndex, cat] of r.categories.entries()) {
      const category = await prisma.menuCategory.upsert({
        where: { id: `${restaurant.id}-${cat.name}` },
        update: { name: cat.name, sortOrder: catIndex, active: true },
        create: { id: `${restaurant.id}-${cat.name}`, restaurantId: restaurant.id, name: cat.name, sortOrder: catIndex },
      });
      for (const [itemIndex, item] of cat.items.entries()) {
        await prisma.menuItem.upsert({
          where: { id: `${restaurant.id}-${item.name}` },
          update: { ...item, categoryId: category.id, sortOrder: itemIndex, available: true },
          create: { id: `${restaurant.id}-${item.name}`, restaurantId: restaurant.id, categoryId: category.id, sortOrder: itemIndex, ...item },
        });
      }
    }
  }

  console.log("Restaurantes seed:", restaurants.length);
}

main().finally(() => prisma.$disconnect());
