# Arquitectura y Documentación Técnica
**Proyecto:** Consultas Refugio v2
**Fecha:** 2026-06-15

## 1. Visión General
Consultas Refugio v2 es un asistente inteligente diseñado para **Refugio Gastronómico**, un centro gastronómico/comercial. Proporciona funcionalidades avanzadas de análisis y conciliación de datos, integrando modelos de Inteligencia Artificial (Gemini, Claude, GPT, DeepSeek) con bases de datos en la nube (BigQuery) y orígenes de datos locales/externos.

## 2. Stack Tecnológico
El proyecto está construido sobre un stack moderno basado en React y Node.js:
- **Framework:** Next.js 16.2.6 (App Router, Turbopack)
- **Lenguaje:** TypeScript 5.7
- **Estilos:** Tailwind CSS 4.0 con PostCSS
- **Inteligencia Artificial:** Vercel AI SDK (@ai-sdk/react, @ai-sdk/google, @ai-sdk/anthropic, @ai-sdk/openai)
- **Base de Datos / Data Warehouse:** Google BigQuery (@google-cloud/bigquery)
- **Visualización:** Plotly.js, Recharts, Lucide React (Iconos)
- **Procesamiento de archivos:** XLSX (SheetJS)
- **Exportación:** jsPDF, html2canvas
- **Tareas programadas:** Node-cron

## 3. Estructura de Directorios
La estructura sigue el estándar de Next.js App Router:

```text
├── src/
│   ├── app/             # Rutas de la aplicación (App Router)
│   │   ├── api/         # Endpoints del backend (Next.js API Routes)
│   │   │   ├── ai/      # Endpoints para streaming y chat con IA
│   │   │   ├── dashboard/ # Endpoints para reportes y KPIs
│   │   │   ├── toteat/    # Endpoints del dashboard Toteat
│   │   │   ├── instancias/# Manejo de instancias de conciliación
│   │   │   └── scheduler/ # Endpoints para tareas programadas
│   │   ├── toteat/        # Dashboard de ventas Toteat (UI)
│   │   ├── auditoria/   # Módulo de auditoría
│   │   ├── instancias/  # Módulo de gestión de conciliación
│   │   ├── proyecciones/# Módulo de proyecciones
│   │   └── reporteria/  # Módulo de reportería avanzada
│   ├── components/      # Componentes React reutilizables
│   │   ├── assistant/   # UI del chatbot y asistencia
│   │   ├── dashboard/   # Tarjetas de KPIs, gráficos, filtros
│   │   ├── toteat/      # Cruce interno Refugio/Sisa/Limanesas
│   │   └── ui/          # Componentes base (Botones, inputs)
│   ├── contexts/        # Estados globales (React Context)
│   │   └── chat-context.tsx # Manejo del estado del chat global
│   └── lib/             # Lógica de negocio y utilidades
│       ├── ai/          # Configuración, prompts y proveedores de IA
│       ├── data/        # Clientes de BD (BigQuery, Cuadre Tarjetas)
│       ├── toteat/      # Agregación de datos y reportes Toteat
│       └── scheduler/   # Configuración de Cron Jobs
├── data/                # Archivos locales generados (configuraciones JSON)
├── public/              # Archivos estáticos
└── package.json         # Dependencias y scripts
```

## 4. Módulos Principales

### 4.1. Módulo de Inteligencia Artificial
**Ubicación:** `src/lib/ai/`
El sistema es agnóstico al proveedor de IA y soporta múltiples modelos. Funciona como un orquestador que:
1. Analiza la intención del usuario (`Context Builder`).
2. Selecciona el prompt del sistema adecuado (Ventas, Flujo, Estacionamiento, Cuadre de Tarjetas).
3. Obtiene datos relevantes de las bases de datos mediante BigQuery o el cliente de Cuadre.
4. Procesa la respuesta de forma fluida (Streaming) usando Vercel AI SDK hacia el cliente.

### 4.2. Módulo de Conciliación (Cuadre de Tarjetas)
**Ubicación:** `src/lib/data/cuadre-tarjetas-client.ts`
Es el corazón financiero del aplicativo. Realiza conciliación de pagos entre el sistema POS (Toteat) y procesadores (Niubiz, Amex, Diners). Gestiona:
- **Vouchers Huérfanos:** Pagos sin contrapartida en Toteat.
- **Cobertura:** Porcentaje de ventas cuadradas.
- **Algoritmos:** Emplea algoritmos de scoring, genéticos y simulated annealing para hacer match entre transacciones.

### 4.3. Módulo BigQuery (Data Warehouse)
**Ubicación:** `src/lib/data/bigquery-client.ts`
Interactúa con Google Cloud (proyecto: `neat-chain-450900-a1`) para extraer:
- **Ventas:** Transacciones por local, turnos, categorías.
- **Estacionamiento:** Registros de cámaras, entradas/salidas, zonas.
- **Flujo de personas:** Aforo, sensores en puertas.

El sistema cuenta con un generador de SQL por IA (`src/lib/ai/sql-generator.ts`) que traduce consultas en lenguaje natural a sentencias BigQuery ejecutables.

### 4.4. Módulo Toteat (Dashboard de Ventas)

**Ubicación principal:**
- UI: `src/app/toteat/page.tsx`
- Agregación: `src/lib/toteat/dashboard-data.ts`
- Configuración de restaurantes: `src/lib/toteat/restaurants-config.ts`
- Reportes programados: `src/lib/toteat/report-generator.ts`
- Cruce interno (UI): `src/components/toteat/business-split-panel.tsx`
- API interna: `src/app/api/toteat/dashboard`, `src/app/api/toteat/restaurants`

Este módulo consume la **API REST de Toteat** (`/mw/or/1.0`) y expone un dashboard operativo alineado con el reporte nativo de cierres de Toteat, más un **cruce interno** entre los tres negocios del complejo: **Bar Refugio**, **Sisa** y **Limanesas**.

#### 4.4.1. Endpoints de la API Toteat utilizados

| Endpoint Toteat | Método | Parámetros clave | Uso en el proyecto |
| --- | --- | --- | --- |
| `/sales` | GET | `xir`, `xil`, `xiu`, `xapitoken`, `ini`, `end` | Fuente principal de ventas, productos, medios de pago, meseros y métricas financieras |
| `/orders/cancellation-report` | GET | credenciales + `start_date`, `end_date` (`YYYY-MM-DD`) | Cancelaciones, anulaciones y líneas canceladas |
| `/fiscaldocuments` | GET | credenciales + `ini`, `end` (`YYYYMMDD`) | Documentos fiscales (opcional; depende de permisos del token) |

**Base URL por defecto:** `https://api.toteat.com/mw/or/1.0` (configurable con `TOTEAT_BASE_URL`).

**Autenticación:** cada restaurante requiere `xir`, `xil`, `xiu` y `xapitoken`. El proyecto soporta un restaurante único por variables de entorno o múltiples restaurantes vía `TOTEAT_RESTAURANTS_JSON`.

**Límite de rango:** las consultas se dividen en bloques de hasta **15 días** para evitar timeouts de la API.

#### 4.4.2. Campos relevantes del endpoint `/sales`

Cada fila en `data[]` representa un **cierre de pago** (no necesariamente una orden única; una orden puede tener varias filas).

| Campo Toteat | Tipo | Descripción | Uso en dashboard |
| --- | --- | --- | --- |
| `orderId` | number/string | Identificador de orden | Conteo de órdenes, top meseros, cruce interno |
| `dateClosed` | ISO datetime | Fecha/hora de cierre | Filtro por turno/hora (zona `America/Lima`) |
| `waiterName` | string | Mesero | Ranking de meseros |
| `zoneName` | string | Zona/sector (ej. Cafetería) | Clasificación Sisa vs Refugio |
| `total` | number | Venta bruta de la fila | KPI principal, gráficos, top meseros |
| `discounts` | number | Descuentos (negativos) | KPI y cálculo bruta − descuentos |
| `taxes` | number | Impuestos | KPI y venta neta |
| `subtotal` | number | Subtotal sin impuestos | Disponible en API; validación interna |
| `payed` | number | Monto pagado (incl. propina) | KPI "Pagado", cruce interno por línea |
| `gratuity` | number | Propina | KPI de propinas |
| `paymentForms[]` | array | `{ name, amount }` | Medios de pago |
| `products[]` | array | `{ name, quantity, payed, hierarchyName }` | Top productos y cruce interno |

**Otros campos disponibles en la API** (no usados aún en KPIs principales): `client`, `tableName`, `registerName`, `fiscalId`, `fiscalType`, `numberClients`, `totalCost`, `totalWithGratuity`, `change`, `difference`.

#### 4.4.3. Métricas calculadas y equivalencia con Toteat

El dashboard replica la lógica del **Resumen de Ventas** del cierre nativo de Toteat:

| Métrica en dashboard | Fórmula | Equivalente en Toteat |
| --- | --- | --- |
| Venta Bruta | `Σ total` | Total Venta Bruta |
| Descuentos | `Σ discounts` | Total Descuentos |
| Bruta − Descuentos | `Σ total + Σ discounts` | Total Venta Bruta (tras descuentos) |
| Impuestos | `Σ taxes` | Impuestos |
| Venta Neta | `(Σ total + Σ discounts) − Σ taxes` | Venta Neta |
| Pagado | `Σ payed` | Cobros recibidos (incluye propina) |
| Propinas | `Σ gratuity` | Total Propinas |
| Órdenes | `COUNT(DISTINCT orderId)` | Número de Órdenes |
| Pagos / cierres | `COUNT(filas)` | Registros de cierre en `/sales` |

**Ajuste de conciliación:** Toteat puede emitir el mismo `orderId` en dos filas (positiva y negativa) cuando una orden se anula/revierte. Si el neto por orden es `total = 0` y `payed = 0`, esas filas se **excluyen** del conteo de órdenes y propinas para alinear con el reporte nativo. Las ventas brutas y netas no cambian porque las filas se compensan.

#### 4.4.4. Filtros disponibles en la UI

| Filtro | Parámetro API interna | Comportamiento |
| --- | --- | --- |
| Rango de fechas | `start_date`, `end_date` | Formato `YYYY-MM-DD`, inclusive |
| Restaurante | `restaurant` | ID del restaurante configurado |
| Turno | `hour_from`, `hour_to` | Hora de cierre en `America/Lima` |
| Todo el día | sin horas | Sin filtro horario |
| Mañana | `8` → `11` | 08:00–11:59 |
| Tarde | `12` → `15` | 12:00–15:59 |
| Noche | `16` → `7` | 16:00–07:59 (cruza medianoche) |

#### 4.4.5. Cruce interno (Refugio / Sisa / Limanesas)

El cruce interno **no viene de Toteat**; se calcula en el proyecto a partir de `products[]` de cada fila de venta.

**Reglas de clasificación** (detalle de ventas — zona + categoría; **no** ventas por jerarquía):

1. Si `zoneName` contiene "cafeter" → **Sisa**
2. Si `hierarchyName` o `name` del producto contiene "limanesa" → **Limanesas**
3. Fuera de Cafetería: categoría **Aperitivo Cafetería Sisa** o categoría exacta **Sisa** → **Sisa** (no *Sisa Bar*)
4. Resto → **Refugio** (Bar Refugio)

**Nota:** el cruce interno **no** replica el reporte *ventas por jerarquía* (p. ej. AB.200 / AB.300360). Para Sisa puede diferir ~0,1–2% vs jerarquía por ventas en otra zona con carta distinta.

**Monto asignado:** `products[].payed` por línea (estimado operativo, no contable fiscal).

**Métricas por negocio:** total, porcentaje, órdenes únicas y cantidad de líneas.

#### 4.4.6. Cancelaciones (`/orders/cancellation-report`)

| Campo API | Uso |
| --- | --- |
| `status` | Agrupación por estado (`CANCELED`, etc.) |
| `comments` | Motivos frecuentes |
| `cart[]` con `canceled: true` | Líneas canceladas y monto estimado (`quantity × unit_price`) |
| `payments[].amount_paid` | Pagos asociados a órdenes canceladas |
| `closed_at` | Filtro por turno/hora |

#### 4.4.7. API interna del proyecto

| Ruta | Descripción |
| --- | --- |
| `GET /api/toteat/restaurants` | Lista restaurantes configurados (`id`, `name`) |
| `GET /api/toteat/dashboard` | Agrega y devuelve todos los KPIs, gráficos y rankings |

**Query params de `/api/toteat/dashboard`:**

```
start_date=2026-06-14
end_date=2026-06-15
restaurant=default
hour_from=8      # opcional, 0-23
hour_to=11       # opcional, 0-23
```

**Respuesta incluye:** métricas financieras, `charts` (por turno/día/hora), `top_waiters`, `payment_methods`, `top_products`, `business_split`, `cancellations`, `fiscal_documents`.

#### 4.4.8. Reportes programados por correo

En **Configuración → Tareas programadas** se puede crear una tarea con `module: "toteat"` que:

- Consulta la API Toteat en el periodo configurado (`yesterday`, `last_7_days`, etc.)
- Genera reporte en **Markdown** (cuerpo del correo) y **CSV** adjunto
- Permite elegir restaurante y filtro horario por turno
- Se ejecuta vía `node-cron` (`src/lib/scheduler/cron-manager.ts`)

Tarea por defecto: **"Reporte Diario Toteat"** (`daily-toteat`).

#### 4.4.9. Variables de entorno

**Restaurante único:**

```env
TOTEAT_BASE_URL=https://api.toteat.com/mw/or/1.0
TOTEAT_XIR=...
TOTEAT_XIL=...
TOTEAT_XIU=...
TOTEAT_XAPITOKEN=...
TOTEAT_RESTAURANT_NAME=Restaurante principal
TOTEAT_RESTAURANT_ID=default
TOTEAT_TIMEOUT_MS=20000
```

**Múltiples restaurantes** (`TOTEAT_RESTAURANTS_JSON`):

```json
[
  {
    "id": "bar-refugio",
    "name": "Bar Refugio",
    "xir": "...",
    "xil": "...",
    "xiu": "...",
    "xapitoken": "..."
  }
]
```

#### 4.4.10. Flujo de datos

```text
Toteat API (/sales, /orders/cancellation-report, /fiscaldocuments)
        ↓
getToteatDashboardData()  — filtro horario, exclusión órdenes compensadas, agregación
        ↓
GET /api/toteat/dashboard
        ↓
UI /toteat  — KPIs, gráficos, rankings, cruce interno
        ↓
generateToteatScheduledReport()  — correos programados (markdown + CSV)
```

## 5. Despliegue y Contenedorización
El proyecto está preparado para producción usando Docker. Usa un `Dockerfile` multi-stage basado en `node:20-alpine` y Docker Compose para orquestación. Next.js está configurado para output `standalone`, optimizando el tamaño final de la imagen.

## 6. Autenticación y usuarios (PostgreSQL)

Cuando `DATABASE_URL` está definido, la app exige login con sesión JWT (cookie httpOnly, 7 días).

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | Conexión PostgreSQL |
| `AUTH_SECRET` | Clave para firmar sesiones (obligatorio con auth) |
| `AUTH_ADMIN_EMAIL` / `AUTH_ADMIN_PASSWORD` | Seed del primer admin si la tabla está vacía |

**Roles:** `admin` (gestión completa + usuarios), `analyst` (operación sin gestión de usuarios), `viewer` (solo lectura en dashboards).

Sin `DATABASE_URL`, la app sigue funcionando en modo desarrollo sin login.

Servicio Postgres local opcional: `docker compose up consultas-refugio-pg -d`.

## 7. Despliegue en producción (VPS)

| Elemento | Valor |
| --- | --- |
| Servidor | `62.169.23.24` (SSH: `~/.ssh/vps_estacionamiento`) |
| Ruta del proyecto | `/opt/consultas-refugio-v2` |
| Dominio | `https://consultas.gcbprojects.site` |
| Puerto directo | `8083` → contenedor `consultas-refugio-v2:3000` |
| Proxy | `nginx_proxy` → `consultas-refugio-v2:3000` |
| Base de datos | `consultas-refugio-pg` (PostgreSQL 16) |

**Procedimiento de actualización:**

```bash
# 1. Sincronizar código (desde máquina local)
tar --exclude=node_modules --exclude=.next --exclude=.git \
  --exclude=.env.local --exclude=data -czf - . \
  | ssh -i ~/.ssh/vps_estacionamiento root@62.169.23.24 \
  "cd /opt/consultas-refugio-v2 && tar xzf -"

# 2. Rebuild y restart en VPS
ssh -i ~/.ssh/vps_estacionamiento root@62.169.23.24 \
  "cd /opt/consultas-refugio-v2 && docker compose build consultas-refugio-v2 && docker compose up -d"

# 3. Recargar nginx (necesario tras recrear contenedor)
ssh -i ~/.ssh/vps_estacionamiento root@62.169.23.24 \
  "docker exec nginx_proxy nginx -s reload"
```

**Nota:** `.env.production` vive solo en el VPS y no se sobrescribe con el sync local (está en `.gitignore`).

#### 4.4.11. Ticket promedio (total y por negocio)

La API Toteat **no expone un endpoint ni un campo `ticketPromedio`**. El reporte nativo de cierres muestra ventas y número de órdenes; el ticket promedio es una **métrica derivada** que el proyecto calcula a partir de `/sales`, con la misma base que el resto del dashboard (`getToteatDashboardData` en `src/lib/toteat/dashboard-data.ts`).

##### Campos de la API involucrados

| Campo `/sales` | Rol en ticket promedio |
| --- | --- |
| `orderId` | Denominador: órdenes únicas (`COUNT(DISTINCT orderId)`), excluyendo órdenes totalmente compensadas (ver §4.4.3) |
| `total` | Numerador bruto: `Σ total` |
| `discounts`, `taxes` | Para variantes neta: `(Σ total + Σ discounts) − Σ taxes` |
| `numberClients` | Opcional: comensales por cierre; permite **ticket por comensal** (no por orden) |
| `products[].payed` | Numerador del cruce interno por negocio (Refugio / Sisa / Limanesas) |

##### Fórmulas (equivalente al cierre Toteat)

**Ticket promedio total (por orden / comanda)** — alineado con el KPI "Número de Órdenes" del cierre:

| Variante | Fórmula | Uso recomendado |
| --- | --- | --- |
| Bruto | `total_sales / orders_count` | Comparar con reporte nativo Toteat (venta bruta) |
| Neto | `total_net_sales / orders_count` | Análisis operativo sin impuestos |
| Por comensal | `total_sales / clients_count` | Solo si se agrega `numberClients` por orden |

Donde:

- `total_sales` = `Σ total` (filas filtradas por fecha/turno)
- `orders_count` = órdenes distintas tras excluir compensadas
- `clients_count` = suma de comensales **por orden** (tomar el `MAX(numberClients)` de las filas del mismo `orderId` para no duplicar en órdenes con varios cierres de pago)

**Ticket promedio por negocio (cruce interno)** — no viene de Toteat; usa las reglas de §4.4.5:

```
ticket_promedio_negocio = businessTotals[negocio] / businessOrders[negocio].size
```

| Negocio | Numerador | Denominador |
| --- | --- | --- |
| Refugio | `Σ products[].payed` clasificados como Refugio | `COUNT(DISTINCT orderId)` con al menos una línea Refugio |
| Sisa | idem (zona Cafetería; fuera: categoría *Aperitivo Cafetería Sisa* o *Sisa*; no *Sisa Bar*) | órdenes con líneas Sisa |
| Limanesas | idem (producto/categoría "limanesa") | órdenes con líneas Limanesas |

**Importante:** una misma orden puede contar en más de un negocio si mezcla productos (p. ej. bar + cafetería). El ticket por negocio mide el **monto promedio atribuido** a ese negocio por orden que lo tocó, no reparte el total de la mesa entre negocios.

##### Ejemplo de consulta (respuesta API interna propuesta)

Parámetros iguales a `GET /api/toteat/dashboard`. Campos adicionales sugeridos en la respuesta:

```json
{
  "average_ticket_gross": 87.45,
  "average_ticket_net": 74.12,
  "average_ticket_per_client": 43.72,
  "clients_count": 412,
  "business_split": {
    "by_business": [
      {
        "business": "Refugio",
        "total": 12500.0,
        "orders": 98,
        "average_ticket": 127.55
      },
      {
        "business": "Sisa",
        "total": 8200.0,
        "orders": 145,
        "average_ticket": 56.55
      }
    ]
  }
}
```

##### Estado actual vs. pendiente

| Elemento | Estado |
| --- | --- |
| Datos fuente (`/sales`, agregación, cruce interno) | Implementado |
| KPI ticket promedio en UI `/toteat` | Pendiente de exponer (cálculo trivial sobre datos ya agregados) |
| Campo `numberClients` en agregación | Pendiente (campo disponible en API, no mapeado en `ToteatSaleRow`) |
| Ticket en reportes programados por correo | Pendiente |

---

## 8. Propuesta: consultas Toteat vía agente de IA (chat)

Hoy el chat (`src/lib/ai/context-builder.ts`) enruta preguntas de ventas a **BigQuery** y menciones de "toteat" suelen caer en el módulo **cuadre_tarjetas** (conciliación). No existe aún un módulo dedicado que consulte la **API REST Toteat en vivo** como lo hace el dashboard `/toteat`.

### 8.1. Objetivo

Permitir preguntas en lenguaje natural del tipo:

- *"¿Cuál fue el ticket promedio de Sisa el fin de semana pasado?"*
- *"Top 5 meseros en Toteat ayer en turno noche"*
- *"Compara ventas netas Toteat vs BigQuery la semana pasada"*

---------------------------

| Fase | Alcance | Esfuerzo |
| --- | --- | --- |
| Fase 1 | Módulo + prompt + formatter + KPI ticket en dashboard-data | ~1–2 días |
| Fase 2 | Tools en `/api/ai/chat` | ~1 día |
| Fase 3 | Comparativas Toteat/BQ en un solo turno | ~0.5–1 día |





## 9. Catálogo BigQuery (chat / SQL generator)

**Proyecto:** `neat-chain-450900-a1` · **Location:** `US`

Fuente única en código: `src/lib/data/bigquery-client.ts` (`BQ_CATALOG`, `BQ_SCHEMA`). El generador SQL (`sql-generator.ts`) y los prompts del chat consumen `getSchemaText()`.

### Datasets y tablas

| Dataset | Tablas |
| --- | --- |
| **Ventas** | `sales_df` (principal), `Negocios`, `Categorias`, `Presupuesto`, `MontosMeta`, `MontosMetaMicro`, `Predicciones`, `Pronostico` |
| **Estacionamiento** | `Registro` (movimientos), `Vehiculos`, `Lugares`, `Tarifas_horarias`, `Tarifas_excepcionales`, `Visitantes_proveedores` |
| **flujo_de_personas** | `Personas_por_zonas`, `Total_Puertas_Hora` |

### Tablas clave por módulo de chat

| Módulo | Tabla principal | JOINs frecuentes |
| --- | --- | --- |
| Ventas | `Ventas.sales_df` | `Negocios` (CodigoNegocio), `Categorias` (Producto), `Presupuesto` (meta) |
| Estacionamiento | `Estacionamiento.Registro` | `Lugares` (codigo_lugar), `Vehiculos` (placa) |
| Flujo | `flujo_de_personas.Personas_por_zonas` | `Total_Puertas_Hora` (aforo por puerta) |

### Verificación en BigQuery

```sql
-- Datasets
SELECT catalog_name, schema_name, location
FROM `neat-chain-450900-a1`.INFORMATION_SCHEMA.SCHEMATA;

-- Tablas por dataset
SELECT 'Ventas' AS schema_name, table_name FROM `neat-chain-450900-a1.Ventas.INFORMATION_SCHEMA.TABLES`
UNION ALL
SELECT 'Estacionamiento', table_name FROM `neat-chain-450900-a1.Estacionamiento.INFORMATION_SCHEMA.TABLES`
UNION ALL
SELECT 'flujo_de_personas', table_name FROM `neat-chain-450900-a1.flujo_de_personas.INFORMATION_SCHEMA.TABLES`
ORDER BY schema_name, table_name;
```

**Nota:** Se eliminó `PresupuestoDiario` del esquema documentado — no existe en el catálogo actual de BigQuery.

---

## 10. Iteraciones UI y marca

| Iteración | Estado | Detalle |
| --- | --- | --- |
| Marca | ✅ | Usar **Refugio Gastronómico** (`COMPANY_NAME`), no "El Refugio" |
| Chat responsive | ✅ | Header en dos filas: título + acciones arriba; modo/modelo abajo (`ChatHeader`) |
| Icono robot | ✅ | Bot en FAB, header, empty state y chat compacto |

===============================================================================
===============================================================================





