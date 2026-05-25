# BuySell Asturias

## Objetivo

Webapp para registrar inmuebles en venta (casas, pisos, apartamentos, chalets, etc.) con seguimiento histórico de precios y, más adelante, scrapers a portales (Idealista, Fotocasa, Pisos.com, Milanuncios) para detectar cambios de precio o estado.

Uso propio inicialmente; arquitectura preparada para escalar (multi-usuario, descubrimiento por búsquedas guardadas).

## Brief funcional

Cada inmueble debe registrar:

- **Datos básicos**: título, descripción, tipo (casa, piso, ático, chalet, etc.), estado (en venta, reservado, vendido, retirado).
- **Precio**: precio actual + histórico de cambios.
- **Ubicación**: dirección, ciudad, provincia, país, coordenadas (lat/lng).
- **Entorno**: barrio, servicios cercanos, transporte, zonas verdes (texto libre + tags).
- **Características**: habitaciones, baños, m² construidos, m² útiles, planta, ascensor, garaje, trastero, terraza, chimenea, año de construcción, eficiencia energética, etc.
- **Medios**: fotos, planos, enlaces a vídeos / tours virtuales.
- **Origen**: portal de origen (Idealista, Fotocasa, etc.) + URL del anuncio. Un inmueble puede tener varias publicaciones (listings) en distintos portales.

Funciones del usuario:
- CRUD de inmuebles desde UI sencilla.
- Filtrado y búsqueda (precio, ubicación, habitaciones, chimenea, etc.).
- Ver histórico de precios de cada inmueble.
- Marcar / detectar inmuebles como "vendido".

Automatización (fase 2):
- Scrapers que revisan periódicamente las URLs vinculadas y detectan cambios de precio o desaparición/venta.
- Arquitectura lista desde el día 1 (modelo de datos + puntos de integración), pero scrapers se implementan después.

## Stack acordado

_Pendiente de confirmar tras propuesta inicial._

## Forma de trabajar

1. Proponer stack, estructura de carpetas y esquema de BD antes de escribir código.
2. Acordar con el usuario.
3. Scaffoldear ficheros iniciales (backend + frontend mínimo) explicando qué hace cada uno y cómo arrancar.
4. Iterar: pulir modelo, mejorar UI, diseñar módulo de scrapers.

Explicar decisiones brevemente. Cuando haya varias opciones razonables, recomendar una y justificarla.
