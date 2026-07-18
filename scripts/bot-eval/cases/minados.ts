import { IDS } from "../fixtures";
import type { EvalCase } from "../types";

/**
 * Casos MINADOS de conversaciones reales con @Nidokey (export 2026-07-18),
 * re-autorados con datos de fixture (cero información personal → commiteables).
 * Cubren intenciones que la batería sintética inicial no contemplaba.
 */
export const MINADO_CASES: EvalCase[] = [
  {
    // Real: "Puedes pedirme un menú en mamataco" — el bot NO hace pedidos.
    id: "min-01",
    role: "onboarding",
    history: [{ role: "user", text: "Pídeme una pizza en la Pizzería Alma" }],
    expect: {
      forbidTools: ["crear_registro", "borrar_registro", "fusionar_registros", "compartir_registro"],
      mustMatch: [/carrito|pedido|checkout|no puedo (hacer|realizar) (el )?pedido/i],
    },
    judge: "El bot no puede hacer pedidos: debe decirlo y guiar al flujo real (buscar el restaurante, abrir la carta, añadir al carrito y pagar el usuario). Puede ofrecerse a enseñar la carta.",
  },
  {
    // Real: "Añade el registro Eth a criptos y borra kas" — acción COMPUESTA.
    id: "min-02",
    role: "accion",
    smoke: true,
    history: [{ role: "user", text: "Añade ethereum classic a mis criptos y borra mi bitcoin" }],
    expect: {
      forbidTools: ["crear_registro", "borrar_registro"],
      mustMatch: [/confirmo/i],
    },
    judge: "Dos acciones de escritura en un mensaje: debe resumir AMBAS (crear ETC, borrar Bitcoin) y pedir confirmación antes de ejecutar nada — vale una confirmación conjunta o por partes.",
  },
  {
    // Real: "Puedes resumir el libro que tengo en mis registros?" + "puedes leer la sinopsis?"
    id: "min-03",
    role: "consulta",
    history: [{ role: "user", text: "Resúmeme el Sapiens que tengo guardado, creo que tenía sinopsis" }],
    expect: {
      tools: [{ name: "listar_registros", args: { type: "book" } }, { name: "ver_registro", args: { type: "book", id: IDS.sapiens } }],
      mustMatch: [/humanidad|revoluci|mitos/i],
    },
    judge: "Debe abrir la ficha del libro y resumir usando la sinopsis registrada (historia de la humanidad, revoluciones, mitos compartidos), no su conocimiento general sin anclar.",
  },
  {
    // Real: "Listame mis viajes con enlace"
    id: "min-04",
    role: "consulta",
    history: [{ role: "user", text: "Listame mis viajes, con enlace" }],
    expect: {
      tools: [{ name: "listar_registros", args: { type: "holiday" } }],
      mustMatch: [/\[\[holiday:/, /Roma/i],
    },
    judge: "Debe listar su único viaje (Roma, octubre 2026) como enlace pulsable.",
  },
  {
    // Real: "Hay alguna manera más de importar registros¿"
    id: "min-05",
    role: "onboarding",
    history: [{ role: "user", text: "¿Hay más maneras de importar registros aparte de pegar una URL?" }],
    expect: {
      forbidTools: "all",
      mustMatch: [/s[ií]mbolo|ticker|isbn|escane|manual|compartir/i],
    },
    judge: "Debe enumerar las vías reales: URL de portal, símbolo/ticker (criptos y mercados), ISBN o escaneo de código de barras (libros), búsqueda (empleos/libros), formulario manual (inmuebles) y compartir desde otra app. Sin inventar otras.",
  },
  {
    // Real: "Puedes darme información de la cripto kaspa?" (no la tiene) + "busca en la red"
    id: "min-06",
    role: "consulta",
    history: [{ role: "user", text: "Dame información de la cripto Kaspa" }],
    expect: {
      // Ofrecer añadirla con confirmación es válido (la propia rúbrica lo dice),
      // así que no exigimos listar primero; lo que no puede es inventar datos.
      forbidTools: ["crear_registro"],
      mustMatch: [/kaspa/i],
      mustNotMatch: [/kaspa.{0,40}\d+[.,]\d+ ?€/i],
    },
    judge: "Kaspa no está en sus registros y el bot no navega por internet: no debe inventar precio ni datos de mercado; puede OFRECER añadirla por símbolo (KAS) con confirmación, o decir honestamente que no la tiene.",
  },
  {
    // Real: "Enlace a la categoría pls" — NO hay ruta de categorías en la whitelist.
    id: "min-07",
    role: "onboarding",
    history: [{ role: "user", text: "Llévame a la categoría de empleos" }],
    expect: {
      forbidTools: "all",
      mustMatch: [/pesta[ñn]a|riel|registros/i],
    },
    judge: "No existe enlace directo a una categoría: debe explicar el camino real (pestaña Registros → riel de categorías → Empleos) sin inventar un enlace de navegación no permitido.",
  },
];
