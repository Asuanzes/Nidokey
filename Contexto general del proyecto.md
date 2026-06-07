Contexto general del proyecto

Estás trabajando en una app llamada Nidokey (web + móvil) que ya tiene:

- Backend web en Next.js/NextAuth desplegado en Vercel (auth por magic link vía Resend).
- App móvil con Expo/React Native (Android e iOS) con un flujo de auth móvil propio (JWT HS256 con AUTH_SECRET, issuer nidokey-mobile).
- Un modelo de “registros” (listings, entries, etc.) que actualmente está orientado a un tipo concreto (ej. propiedades / listings) y que en el futuro debería escalar a más tipos: cryptos, jobs, workouts, holidays, renting, etc.
- Una UI móvil que actualmente tiene botones mal alineados y formateados, con una experiencia poco fluida.

Objetivo global

Hacer una refactorización profunda y coherente del proyecto con estos objetivos:

1. Backend / lógica de datos
   - Definir una forma única y consistente de obtener registros (records) para la app, independientemente del tipo de registro.
   - Preparar el modelo de datos y la capa de acceso para soportar múltiples tipos de registros (cryptos, jobs, workouts, holidays, renting, etc.) sin romper lo actual.
   - Mantener los datos de cada registro actualizados en “tiempo casi real” (polling, SWR, o suscripción si ya existe algo).
   - Reducir duplicación y acoplamiento en la lógica de fetching.

2. App móvil (Android / iOS, Expo)
   - Refactorizar la UI para que sea:
     - Más intuitiva.
     - Más fluida en navegación.
     - Visualmente consistente.
   - Arreglar botones mal alineados, estilos inconsistentes y layouts confusos.
   - Preparar la interfaz para escalar a más tipos de registros:
     - Una única manera de representar listas de registros.
     - Detalles de cada registro con un patrón común.
     - Facilidad para añadir nuevos tipos sin reescribir toda la UI.
     - Rediseñar el icono de la app móvil según la identidad de marca, más genérica, abstracta y profesional

3. Arquitectura
   - Introducir/usar una arquitectura clara en la app móvil:
     - Capas separadas: data (API clients), domain (modelos/transformaciones), UI (screens/components).
     - Evitar que la UI hable directamente con la API sin pasar por una capa de cliente.
   - Refactorizar el código para que sea mantenible, bien tipado (TypeScript) y fácil de extender.

Prestaciones / Requisitos

- Debes trabajar sobre el código existente:
  - No eliminar flujos de auth actuales (web y móvil).
  - No cambiar la lógica de seguridad de AUTH_SECRET ni los tokens.
  - No romper el flujo actual de login ni los endpoints que ya funcionan.
- Puedes renombrar funciones/archivos si mejora la claridad, pero debes mantener compatibilidad de rutas / endpoints y explicar los cambios en comentarios si afectan a API pública.
- El proyecto está en TypeScript; mantén y mejora el tipado.
- Usa patrones modernos: React hooks, componetización, hooks de datos (SWR/React Query si ya está, o abstracción propia de fetching).

Instrucciones detalladas

1. Auditoría inicial del repositorio
   - Recorre el código del repo:
     - Backend (Next.js, app router / pages router).
     - Código de obtención de registros (llamadas a API, hooks, servicios).
     - App móvil (carpetas de screens, components, hooks, etc.).
   - Identifica:
     - Dónde se obtienen los registros.
     - Qué modelos de datos existen y cómo están tipados.
     - Cómo se mantiene actualizado el estado (SWR, polling, websockets, etc.).
     - Dónde están los problemas de diseño/arquitectura en la UI.

2. Definir modelo unificado de registros (backend + frontend)
   - Define una interfaz/typo TS genérica para un “registro” base, por ejemplo:

     type RecordType = "property" | "crypto" | "job" | "workout" | "holiday" | "renting" | ...;

     interface BaseRecord {
       id: string;
       type: RecordType;
       title: string;
       description?: string;
       createdAt: string;
       updatedAt: string;
       // campos comunes adicionales
     }

   - Mantén los modelos específicos (por ejemplo, property, crypto, job) extendiendo esta base.
   - Refactoriza la capa de acceso a datos para que:
     - Haya una función/servicio principal para listar registros (getRecords / listRecords) con filtros por tipo.
     - Haya una función/servicio para obtener un registro por id (getRecordById).
   - Asegúrate de que el backend expone endpoints consistentes (ejemplo: /api/records, /api/records/:id) y que los existentes se adaptan a este patrón o se envuelven sin romper compat.

3. Mecanismo de actualización en tiempo (casi) real
   - Revisa cómo se actualizan actualmente los datos:
     - ¿Hay polling? ¿SWR? ¿React Query? ¿Manual fetch en useEffect?
   - Implementa un patrón consistente:
     - Si ya se usa SWR/React Query, centraliza su uso para registros.
     - Si no, introduce un hook común (useRecords / useRecord) con:
       - fetch inicial.
       - revalidación periódica o revalidación bajo demanda.
   - Objetivo: una única forma de traer registros y revalidarlos en tiempo casi real (ej. revalidateOnFocus, intervalos de revalidación, etc.).

4. Refactor de la app móvil: datos
   - Crea un cliente de API móvil (si no existe):

     - src/mobile/api/client.ts
       - Configura BASE_URL con soporte dev/prod:
         - Prod: https://nidokey.es/api
         - Dev: EXPO_PUBLIC_API_URL con fallback a una URL local.
     - Implementa funciones:
       - fetchRecords(params)
       - fetchRecordById(id)
       - etc.

   - Utiliza el modelo unificado de registros, con tipos compartidos si es posible (importables desde un paquete común o carpeta `shared`).
   - Asegúrate de que todas las pantallas móviles que muestran registros utilizan este cliente en lugar de llamadas ad hoc.

5. Refactor de la app móvil: UI/UX
   - Analiza las pantallas actuales (Android/iOS) y detecta:
     - Botones mal alineados.
     - Estilos inconsistentes (colores, tamaños, márgenes).
     - Flujos de navegación confusos o con demasiados pasos.
   - Rediseña la UI con estos criterios:
     - Lista principal de registros:
       - Una vista unificada de “records” donde se puedan filtrar por tipo (tabs, chips, filtros, etc.).
       - Cada ítem debe mostrar información mínima: título, tipo, estado, fecha, etc.
     - Pantalla de detalle de un registro:
       - Layout consistente para todos los tipos, con secciones reutilizables.
       - Posibilidad de mostrar campos específicos por tipo sin romper la estructura común.
     - Navegación:
       - Usa una navegación clara (stack/tab) con nombres de rutas coherentes.
   - Arregla:
     - Botones:
       - Usa un componente Button reutilizable con estilos armonizados.
       - Alineación (flexbox, spacing) consistente.
     - Formularios:
       - Inputs alineados, labels claros, validaciones visibles.

6. Pensar en escalabilidad de tipos de registro (UI preparada)
   - Diseña la UI para que soportar nuevos tipos de registros signifique:
     - Añadir un nuevo valor a RecordType.
     - Añadir una pequeña configuración por tipo (icono, color, campos extra).
   - Implementa un “registry” de tipos de registros en el cliente:

     const RECORD_TYPE_CONFIG = {
       property: { label: "Propiedades", color: "#...", icon: ... },
       crypto: { label: "Criptos", color: "#...", icon: ... },
       job: { ... },
       // etc.
     };

   - Usa esta configuración para:
     - Renderizar labels en la lista.
     - Mostrar iconos/colores específicos en la UI.
   - No implementes toda la lógica de negocio nueva (cryptos/jobs/etc.), solo deja la estructura y la UI preparada para ello.

7. Revisar y mejorar la arquitectura global
   - Separa claramente:
     - Capa de datos (API, repositorios, hooks).
     - Capa de dominio (modelos, transformaciones).
     - Capa de presentación (screens, components).
   - Elimina duplicaciones:
     - Hooks de datos duplicados.
     - Múltiples maneras de obtener registros.
   - Añade comentarios donde sea necesario para explicar los patrones usados (por ejemplo, un README de arquitectura).

8. Validación final
   - Asegúrate de que:
     - La app web sigue funcionando (login, registros actuales).
     - La app móvil puede:
       - Hacer login.
       - Listar registros.
       - Ver detalles de un registro.
     - Todas las llamadas de red funcionan tanto en Android como en iOS (Expo Go) usando HTTPS para producción.
   - Si haces cambios rompientes en rutas/backends, añade adaptadores o comentarios claros.

Entrega esperada
- Código refactorizado:
  - Backend: endpoints/unificación de obtención de registros.
  - App móvil: cliente de datos, UI escalable, botones alineados, navegación limpia.
- Tipos y modelos bien definidos para registros y tipos de registros.
- Comentarios explicativos en puntos clave.
- Opcional: un pequeño resumen (en markdown) de la nueva arquitectura y cómo añadir nuevos tipos de registros en el futuro.
9. Cuidado extremo con la autenticación existente

- La configuración actual de autenticación (web y móvil) YA FUNCIONA y debe tratarse como “zona crítica”:
  - Web:
    - NextAuth/Auth.js con magic link vía Resend.
    - Configuración de AUTH_SECRET, NEXTAUTH_URL, RESEND_API_KEY, RESEND_FROM.
  - Móvil:
    - JWT propio con HS256 y AUTH_SECRET.
    - issuer nidokey-mobile.
    - Sub = userId, payload con email.

- No cambies:
  - La forma en que se generan y verifican los tokens (ni en web ni en móvil).
  - La configuración de Resend (dominio, from, API key) salvo que sea estrictamente necesario y siempre manteniendo compatibilidad con lo que ya funciona.
  - Los endpoints de auth existentes (/api/auth/*, login, middleware de protección).

- Si necesitas mover código relacionado con auth:
  - Hazlo sólo para mejorar organización (por ejemplo, mover helpers a un módulo), pero sin cambiar la lógica.
  - Documenta el cambio con comentarios claros y evita cambios de comportamiento.

10. Plan para la seguridad de los registros de usuario

- Antes de tocar nada, diseña un PLAN de seguridad para los registros de usuario y preséntalo en forma de texto (markdown) como paso previo a implementar cambios. El plan debe cubrir:

  1) Modelado de permisos:
     - Definir claramente qué significa “registro de usuario”:
       - Registros propiedad de un usuario (owner).
       - Registros compartidos/colaborativos (si aplica en el futuro).
     - Establecer reglas básicas:
       - Un usuario sólo puede leer/actualizar/borrar sus propios registros, salvo casos explícitos.
       - Admins (si existen) pueden tener permisos elevador.

  2) Autorización en backend:
     - Proponer dónde y cómo se validará:
       - Middleware (Next.js / Route Handlers / middleware.ts).
       - Helpers de auth (getUserId, requireUserId).
       - Hooks/guards específicos por endpoint.
     - Proponer una capa de “service/repository” donde se compruebe siempre:
       - userId de la sesión ≈ ownerId del registro.
     - Definir patrones para:
       - Fetch de un registro por id (con check de ownership).
       - Listados filtrados por userId.

  3) Seguridad en la app móvil:
     - Especificar cómo se asegurará que:
       - El JWT móvil sólo permite acceder a los registros del userId asociado.
       - No haya endpoints públicos que expongan datos de otros usuarios.
     - Proponer una manera de manejar errores de auth/permiso (mensajes claros en la UI móvil).

  4) Auditoría y logs:
     - Proponer un esquema mínimo de logging:
       - Accesos a registros sensibles.
       - Intentos de acceso a registros de terceros (con userId, recordId, timestamp).

- Una vez presentado el plan:
  - NO implementes directamente todos los cambios de seguridad sin mi aprobación.
  - Primero escribe el plan en detalle (markdown) y detente.
  - Espera a que yo revise ese plan y luego, en una segunda iteración, implementa las medidas acordadas.

Resumen de restricciones críticas:
- No romper ni alterar el flujo de autenticación actual (web y móvil).
- No modificar la lógica de generación/verificación de tokens.
- No cambiar endpoints / rutas de auth sin necesidad.
- Cualquier cambio de seguridad en registros debe seguir el plan acordado y hacerse en una segunda fase tras mi revisión.

11. Uso de Claude Design para la interfaz

- Para el rediseño de la interfaz (Android e iOS), utiliza Claude Design como asistente de diseño:
  - Genera propuestas de layouts (wireframes textuales) para:
    - Pantalla principal de registros (lista + filtros por tipo).
    - Pantalla de detalle de un registro.
    - Navegación entre secciones (tabs, stacks, etc.).
  - Pide a Claude Design que:
    - Defina una jerarquía visual clara (tipografía, tamaños, márgenes).
    - Proponga un sistema de componentes reutilizables (botones, cards, chips de tipo de registro).
    - Asegure la consistencia visual entre Android e iOS (colores, spacing, estados de botones).

- Flujo de trabajo recomendado:
  1) Primero, usa Claude Design para obtener un diseño textual / esquema de componentes:
     - Descripción de pantallas.
     - Distribución de elementos.
     - Estados de interacción (loading, error, empty state).
  2) Después, implementa ese diseño en el código de la app móvil:
     - Refactoriza componentes existentes para alinearse con el diseño acordado.
     - Asegúrate de que:
       - Los botones quedan correctamente alineados.
       - La tipografía y los paddings son coherentes.
       - La navegación es fluida e intuitiva.

- Importante:
  - No inventes una UI completamente nueva sin respetar el branding y las funciones actuales de Nidokey.
  - Mantén el foco en:
    - Corregir alineaciones y formatos de botones.
    - Hacer la interfaz más intuitiva y fluida.
    - Preparar la UI para soportar múltiples tipos de registros (cryptos, jobs, workouts, holidays, renting, etc.) sin romper lo que ya está.