# Toteat × Fidelio — Diccionario API, uso y ejemplos

Documento de referencia de la prueba de integración **Bar Refugio** (API Config ID **1001 – Bar Refugio - Fidelio**).

- **Fecha de prueba:** 2026-08-04  
- **Documentación oficial:** [https://developers.toteat.com/](https://developers.toteat.com/)  
- **Spec OpenAPI:** `https://developers.toteat.com/toteatApi_v2.yaml`  
- **Base URL usada en prueba:** `https://toteatglobal.appspot.com/mw/or/1.0/`  
  (recomendación actual de Toteat: `https://api.toteat.com/mw/or/1.0/`)

> **Seguridad:** no versionar tokens. Usar variables de entorno / `.secrets` (ej. `API_TOTEAT_FIDELIO_1`).

---

## 1. Objetivo de la prueba

Validar que un sistema propio (**Fidelio**) puede:

1. Consultar menú (`GET /products`)
2. Consultar mesas (`GET /tables`)
3. Registrar un pedido en mesa de **Cafetería** (`POST /orders`)
4. Verificar impresión de comanda vía **Print Server** del local (no hay endpoint de impresión)

**Fuera de alcance (confirmado por soporte Toteat / doc):**

- Emitir boleta/factura (DTE) por API
- Anular pedido o comprobante por API
- Asignar mesero por nombre/ID en el body documentado de `POST /orders`

---

## 2. Credenciales (query params comunes)

Todos los endpoints públicos de Toteat usan estos query params ([Configuración API](https://developers.toteat.com/#tag/Configuracion-API) / cada path en OpenAPI):

| Parámetro | Tipo | Obligatorio | Descripción | Valor en prueba Bar Refugio |
|-----------|------|-------------|-------------|------------------------------|
| `xir` | string/integer | Sí | ID del restaurante | `5144440816140288` |
| `xil` | string/integer | Sí | ID del local | `1` |
| `xiu` | string/integer | Sí | ID de **usuario de la API** (no es el mesero/camarero) | `1001` |
| `xapitoken` | string | Sí | Token de la API configurada | *(secreto — `API_TOTEAT_FIDELIO_1`)* |

**Origen en Toteat UI:** Configuración → Print Server & API → API Config → API **1001** → pestaña **General** / URLs en **Seguridad**.

---

## 3. Diccionario de datos — `POST /orders` (alta de pedido)

**Endpoint:** `POST /orders`  
**OperationId:** `postOrder`  
**Summary:** Ingreso nueva orden en Toteat  
**Ref:** [Endpoints – Ingreso nueva orden](https://developers.toteat.com/) · path `paths/create_order.yaml` · schema `NewOrder`

### 3.1 Query adicionales

| Parámetro | Tipo | Obligatorio | Descripción |
|-----------|------|-------------|-------------|
| `orderDetail` | boolean | No | Si `true`, la respuesta incluye detalle expandido (`orderExp`) |

### 3.2 Body raíz (`NewOrder`)

| Campo | Tipo | Obligatorio | Descripción (doc) | Valor usado en prueba Cafetería |
|-------|------|-------------|-------------------|----------------------------------|
| `restaurantId` | integer | Sí (práctico) | ID restaurante dado por Toteat | `5144440816140288` (= `xir`) |
| `localNumber` | integer | Sí (práctico) | Número de local / sede | `1` (= `xil`) |
| `orderId` | integer | No | ID interno Toteat. En alta: `0` o omitir | `0` |
| `tableId` | integer | Condicional | Mesa física. Obtener con `GET /tables` | `110` (mesa **C2**) |
| `orderReference` | string | Recomendado | ID del sistema integrado (Fidelio) | `TEST-A-<timestamp>` |
| `status` | string | Sí (práctico) | `new`, `created`, `preparing`, `ready`, `ondelivery`, `delivered` | `new` |
| `type` | string | Sí | `order`, `delivery`, `takeaway`, `pickup` | `order` (mesa física) |
| `channel` | string | Sí (práctico) | `webstore`, `crm`, `erp`, `pos`, `marketplace`, `app` | `erp` |
| `vendorName` | string | Recomendado | Nombre del proveedor externo | `FIDELIO` |
| `comment` | string | No | Comentario de orden; **sale impreso con la comanda** | `Prueba Fidelio Cafeteria` |
| `operationDate` | string | Recomendado* | Fecha/hora de creación | `2026-08-04T19:25:00` |
| `modifiedDate` | string | Recomendado* | Fecha/hora de modificación | igual a `operationDate` |
| `darkKitchen` | integer | No | ID dark kitchen | *(no usado)* |
| `document` | object | Sí | Detalle: líneas, pagos, cliente | ver §3.3 |

\*En la primera prueba **sin** `operationDate` / `tax` la API respondió `Invalid Parameters`. Con fechas + tax en línea: **OK**.

#### Campos que **no** existen en `NewOrder` (doc)

| Campo | Nota |
|-------|------|
| `waiterId` / `waiterName` / `waiter` | Aparecen en **respuestas** de ventas (`/sales`, `/salesbywaiter`), no en el alta documentada |
| Mesero UI ID `116` (“Mesero Sisa - Fidelio”) | Creado en Toteat; **no** hay campo oficial para enviarlo en `POST /orders` |

### 3.3 `document`

| Campo | Tipo | Descripción | Uso en prueba |
|-------|------|-------------|---------------|
| `line` | array | Productos / extras | 1 ítem RE627 |
| `payments` | array | Pagos (o vacío / omitir si cobra en caja) | `[]` en prueba mesa A; pending en B |
| `customer` | object | Cliente (más relevante en delivery) | usado en variantes delivery/takeaway |
| `dispatcher` | object | Repartidor | no usado |
| `deliveryDate` | string | Fecha delivery | no usado |
| `comment` | string | Comentario nivel delivery | no usado |
| `expectedPayment` | integer | Código pago esperado | no usado |
| `commission` | array | Comisiones | no usado |

### 3.4 `document.line[]` (schema `Lines`)

| Campo | Tipo | Descripción | Valor prueba |
|-------|------|-------------|--------------|
| `lineNumber` | integer | N° de línea | `1` |
| `quantity` | integer | Cantidad | `1` |
| `productCode` | string | Código producto (según config API Productos) | `RE627` |
| `productName` | string | Nombre | `Arroz con pollo` |
| `category` | string | Categoría | `Almuerzos` |
| `amountAfterTax` | number | Monto con impuesto | `24.9` |
| `amountBeforeTax` | number | Monto neto | `24.9` (enviado; Toteat recalculó IVA) |
| `tax` | array | Impuestos `{ name, value }` | `[{ "name": "IVA", "value": 0 }]` |
| `comment` | string | Comentario del ítem | no usado |
| `discount` | number | Descuento en línea | no usado |
| `categoryCode` | string | Código categoría | no usado |
| `seatNumber` | integer | Asiento en mesa | no usado |
| `idUserToteat` | string | “ID de usuario en Toteat (opcional)” | **no usado** — la doc no lo define como mesero/camarero |

**Extras:** se envían como líneas normales **después** del producto padre; Toteat las asocia al producto previo (doc `create_order`).

### 3.5 `document.payments[]` (schema `Payments`) — si se usa

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | integer | En alta: `0` |
| `ref` | string | Referencia externa del pago |
| `amount` | number | Monto de la orden |
| `amountPaid` | number | Monto pagado |
| `tip` | number | Propina |
| `paymentType` | integer | Medio de pago (ej. `1000` Efectivo) |
| `operationDate` | string | Fecha del pago |
| `pending` | boolean | `true` = pago pendiente a confirmar en caja |
| `discount` | array | Descuentos |
| `commission` | array | Comisiones |

**Medios documentados (ejemplos):** `1000` Efectivo, `2000` Tarjeta crédito, `3000` Débito, `4000` Convenio, `9001` Transferencia, etc. (ver tabla en `create_order.yaml`).

**Restricciones doc:**

- No se puede pagar por API un pedido ya abierto.
- Solo se pagan productos al momento de ingresarlos.
- En mesas: si no vienen pagados, se pagan después en caja.

---

## 4. Diccionario — APIs de apoyo usadas

### 4.1 `GET /products` — Obtener menú

| Parámetro | Descripción | Valor prueba |
|-----------|-------------|--------------|
| `activeProducts` | `true` = solo activos (default) | `true` |

**Resultado verificado:**

| Campo respuesta (ítem) | Ejemplo RE627 |
|------------------------|---------------|
| `id` / `localCode` | `RE627` |
| `name` | `Arroz con pollo` |
| `category` | `Almuerzos` |
| `price` | `24.9` |
| `isModifier` | `false` |

Mensaje: `RESTAURANT: Bar Refugio, PRODUCTS SENT` · ~784 productos activos.

### 4.2 `GET /tables` — Obtener mesas

Usado para obtener `tableId` y disponibilidad.

| Campo | Ejemplo C2 |
|-------|------------|
| `tableId` | `110` |
| `tableName` | `C2` |
| `sectorId` | `ZB.040` |
| `sectorName` | `Cafeteria` |
| `available` | `true`/`false` |

Sectores vistos: `Cafeteria`, `Sector A`, `Sector B - Mesas Virtuales`.

### 4.3 `GET /shiftstatus` — Estado de turno

Doc recomienda turno abierto antes de ingresar órdenes.

| Campo | Valor en prueba |
|-------|-----------------|
| `data.status` | `open` |
| `data.restaurantId` | `5144440816140288` |
| `data.localNumber` | `1` |

### 4.4 `GET /orderstatus` — Monitoreo (no habilitado en API 1001)

En Seguridad de la API 1001, **Can get an order** estaba **OFF** → respuesta `Not Authorized`.

Estados documentados relevantes:

**`orderStatus`:** `OPEN` | `CANCELLED` | `CLOSED`

**`deliveryStatusId`:**

| ID | Significado |
|----|-------------|
| 40 | Pedido Nuevo |
| 90 | Impreso en Cocina |
| 100 | En Preparación |
| 110 | Terminado de Preparar |
| 120 | En Reparto |
| 180 | Entregado a Cliente |
| 170 | Anulado por Cliente |
| 172 | Anulado |
| 175 | No Recibido por Cliente |
| 200 | Recaudación Recibida en Local |

---

## 5. Configuración Toteat relevante (UI)

### API 1001 – Pedidos

| Setting | Valor observado |
|---------|-----------------|
| Origen / fuente | `Local` |
| Impresora para Pedidos API | Misma impresora que la local |
| Imprimir copia delivery | ON |
| Sector para Pedidos API | `* Sector Delivery por Defecto` |
| `TOTEATDVYERROR` | ON |
| Post Hook Pedidos | OFF |

### API 1001 – Seguridad (permisos)

| Permiso | Estado |
|---------|--------|
| Can post new order (`POST /orders`) | **ON** |
| Can get menu (`GET /products`) | **ON** |
| Can get sales / collection / shift / tables / etc. | ON (según captura) |
| Can get an order (`GET /orderstatus`) | **OFF** |
| Can get Fiscal Documents | **OFF** |

### Ajustes Generales – Delivery

- Funcionalidades de Delivery: **ON**
- Fuentes de origen: Telefono, Local, Web, Toteat App, Rappi, PedidosYa (+ opción de catálogo **Integracion Propia** para sistemas propios)

### Print Server

La impresión de comanda **no** es un endpoint API. Ocurre en el local vía **Print Server** al ingresar la orden (confirmado en prueba física).

---

## 6. Respuesta de `POST /orders` (campos útiles)

| Campo | Descripción |
|-------|-------------|
| `ok` | `true`/`false` |
| `msg.texto` | Mensaje (ej. `ORDER: Received, PAYLOAD: Correct JSON`) |
| `orderExp` | Detalle si `orderDetail=true` |
| `orderExp.document.line[]` | Líneas normalizadas (Toteat puede recalcular tax/categoría) |
| `orderId` (en `orderExp`) | ID interno Toteat (16 dígitos) |

En la comanda impresa, el número largo bajo **Comanda:** corresponde a ese `orderId`.

---

## 7. Mapeo comanda impresa ↔ API (prueba 2026-08-04)

Se imprimieron **4** comandas (4 `POST` exitosos tras 1 fallo inicial).

| Comanda impresa | Tipo en ticket | `orderId` | Variante API |
|-----------------|----------------|-----------|--------------|
| `Mesa (C2)` · comentario `Prueba Fidelio Cafeteria` | Mesa | `5741755325349888` | **A** — `type=order` + `tableId=110` |
| `Mesa (C2)` · mismo comentario | Mesa | `4607180456984576` | **B** — mesa + `payments.pending=true` |
| `Delivery: D-80000` · cliente Prueba Fidelio | Delivery | `4971334225231872` | **C** — `type=delivery` |
| `Delivery: D-80001` · `RETIRO EN LOCAL` | Delivery (retiro) | `4991623583629312` | **D** — `type=takeaway` |

Campos visibles en ticket vs payload:

| Ticket | Origen en API |
|--------|----------------|
| `Mesa (C2)` / `Delivery: D-xxxxx` | `type` + `tableId` o flujo delivery |
| Comentario / subtítulo | `comment` |
| Datos cliente | `document.customer` (+ `delivery`) |
| `Comanda: <16 dígitos>` | `orderId` Toteat |
| `1 Arroz con pollo` | `document.line` (`RE627`) |
| `Bar Refugio` | Local autenticado (`xir`/`xil`) |
| Camarero (vacío en tickets) | No enviado — no hay campo documentado en alta |

---

## 8. Ejemplos usados

### 8.1 Auth común (query)

```http
POST /mw/or/1.0/orders?xir=5144440816140288&xil=1&xiu=1001&xapitoken=<TOKEN>&orderDetail=true
Content-Type: application/json; charset=utf-8
```

### 8.2 Ejemplo A — Mesa Cafetería (éxito principal)

```json
{
  "restaurantId": 5144440816140288,
  "localNumber": 1,
  "orderId": 0,
  "tableId": 110,
  "orderReference": "TEST-A-17858894...",
  "status": "new",
  "type": "order",
  "channel": "erp",
  "vendorName": "FIDELIO",
  "comment": "Prueba Fidelio Cafeteria",
  "operationDate": "2026-08-04T19:25:00",
  "modifiedDate": "2026-08-04T19:25:00",
  "document": {
    "line": [
      {
        "lineNumber": 1,
        "quantity": 1,
        "productCode": "RE627",
        "productName": "Arroz con pollo",
        "category": "Almuerzos",
        "amountBeforeTax": 24.9,
        "amountAfterTax": 24.9,
        "tax": [{ "name": "IVA", "value": 0 }]
      }
    ]
  }
}
```

**Respuesta (resumen):** `ok: true` · `ORDER: Received` · `orderId: 5741755325349888`  
**UI:** Pedidos → `.Cafeteria` → mesa **C2** ocupada  
**Impresión:** comanda `Mesa (C2)` confirmada en impresora del local

### 8.3 Ejemplo B — Mesa + pago pendiente

Igual que A, agregando:

```json
"payments": [
  {
    "id": 0,
    "ref": "PENDING-TEST",
    "amount": 24.9,
    "amountPaid": 24.9,
    "tip": 0,
    "paymentType": 1000,
    "operationDate": "2026-08-04T19:25:00",
    "pending": true
  }
]
```

**orderId:** `4607180456984576` · también imprimió comanda **Mesa (C2)**

### 8.4 Ejemplo C — Delivery

```json
{
  "restaurantId": 5144440816140288,
  "localNumber": 1,
  "orderId": 0,
  "orderReference": "TEST-C-...",
  "status": "new",
  "type": "delivery",
  "channel": "erp",
  "vendorName": "FIDELIO",
  "operationDate": "2026-08-04T19:25:00",
  "modifiedDate": "2026-08-04T19:25:00",
  "document": {
    "line": [
      {
        "lineNumber": 1,
        "quantity": 1,
        "productCode": "RE627",
        "productName": "Arroz con pollo",
        "category": "Almuerzos",
        "amountBeforeTax": 24.9,
        "amountAfterTax": 24.9,
        "tax": [{ "name": "IVA", "value": 0 }]
      }
    ],
    "customer": {
      "name": "Prueba Fidelio",
      "phoneNumber": "+51999999999",
      "isBusiness": false,
      "delivery": {
        "address": "Prueba",
        "city": "Lima",
        "country": "Peru"
      }
    },
    "payments": [
      {
        "id": 0,
        "ref": "PENDING-TEST",
        "amount": 24.9,
        "amountPaid": 24.9,
        "paymentType": 1000,
        "operationDate": "2026-08-04T19:25:00",
        "pending": true
      }
    ]
  }
}
```

**orderId:** `4971334225231872` · ticket `Delivery: D-80000`

### 8.5 Ejemplo D — Takeaway

`type: "takeaway"` + cliente mínimo + pago pending.  
**orderId:** `4991623583629312` · ticket `Delivery: D-80001` con nota de retiro en local.

### 8.6 Ejemplo fallido (referencia)

Primer intento **sin** `operationDate` / `modifiedDate` / `tax` y con `payments: []` →

```json
{ "ok": false, "msg": { "texto": "Invalid Parameters", "tipo": 7 }, "errors": ["Critical Error in process..."] }
```

---

## 9. Flujo recomendado Fidelio → Toteat

```text
1. GET /shiftstatus          → turno open
2. GET /products             → mapear códigos (ej. RE627)
3. GET /tables               → tableId libre en Cafeteria
4. POST /orders              → type=order + tableId + líneas + fechas/tax
5. (Opcional) Print Server   → imprime comanda en local
6. Cobro + DTE               → solo en caja/POS Toteat
7. (Opcional) orderstatus    → si se habilita “Can get an order”
```

---

## 10. Referencias rápidas OpenAPI

| Recurso | Path en portal |
|---------|----------------|
| Intro + URLs | `toteatApi_v2.yaml` → `info.description` |
| Configuración API | `tags/config_tag.yaml` |
| Alta orden | `paths/create_order.yaml` |
| Productos | `paths/products.yaml` |
| Mesas | `paths/tables.yaml` |
| Turno | `paths/shiftstatus.yaml` |
| Estado orden | `paths/orderstatus.yaml` |
| Schemas | `components/schemas.yaml` (`NewOrder`, `Lines`, `Payments`) |
| Webhook órdenes | `webhooks/order_webhooks.yaml` |

Soporte (confirmaciones previas): Fernanda Rossel — emisión DTE **no** por API; ingreso de pedidos **sí** con Carga de Órdenes Externas + Delivery/origen.

---

## 11. Checklist post-prueba

- [x] `GET /products` OK  
- [x] `GET /tables` OK  
- [x] `POST /orders` mesa Cafetería OK  
- [x] Impresión física de comanda OK  
- [ ] Habilitar `GET /orderstatus` si se necesita monitoreo  
- [ ] Definir origen **Integracion Propia** (opcional, sistemas propios)  
- [ ] Rotar token si se expuso en capturas de Seguridad  
- [ ] Limpiar/anular en POS pedidos de prueba B/C/D si no aplican  
- [ ] Documentar mapeo productos Fidelio ↔ `productCode` Toteat  

---

*Archivo generado a partir de la prueba controlada Bar Refugio / API Fidelio 1001. No incluye secretos.*
