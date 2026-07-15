---
name: consultas-refugio
description: "Consultas inteligentes al sistema Refugio Gastronómico — ventas, conciliación, estacionamiento, flujo de personas y Toteat vía API."
version: 1.0.0
author: gcbprojects
metadata:
  hermes:
    tags: [refugio, consultas, bigquery, gastronomico]
---

# Consultas Refugio

Skill para consultar datos del **Parque Gastronómico Refugio** a través de la API de
`consultas.gcbprojects.site`. Esta skill encapsula el acceso a todos los módulos:
ventas, conciliación (cuadre tarjetas), estacionamiento, flujo de personas y Toteat.

## Setup

1. Generar API key desde Settings → API Keys en la web (rol: admin)
2. Configurar en Hermes:

```bash
hermes config set consultas_refugio.api_url "https://consultas.gcbprojects.site"
hermes config set consultas_refugio.api_key "hrms_xxx..."
```

## Uso

Hablale en lenguaje natural. La skill detecta el módulo automáticamente según
las palabras clave de la consulta:

| Palabras clave | Módulo |
|----------------|--------|
| ventas, vendido, ingresos, recaudación, productos, categorías | **Ventas** |
| conciliación, cuadre, tarjetas, vouchers, Niubiz, depósitos, efectivo | **Cuadre Tarjetas** |
| estacionamiento, vehículos, autos, parking, placas | **Estacionamiento** |
| flujo, personas, aforo, visitantes, puertas | **Flujo Personas** |
| Toteat, restaurante, comidas, platos | **Toteat** |

## Workflow

1. El usuario hace una consulta en lenguaje natural (Telegram, Discord, CLI)
2. Hermes envía un POST a `{api_url}/api/ai/chat` con:
   - `messages`: el historial de la conversación
   - `chatMode`: "auto" (o "toteat" si es específico)
   - Header: `Authorization: Bearer {api_key}`
3. La API responde en streaming con los datos de BigQuery + PostgreSQL
4. Hermes entrega la respuesta al usuario

## Ejemplos

```text
User: "Cuánto se vendió ayer?"
Hermes: [consulta a API] → "Ayer se vendió S/ 48,230. Los negocios
con mayor facturación fueron..."
```

```text
User: "Dame el flujo de personas de esta semana"
Hermes: [consulta a API] → "Esta semana ingresaron 12,450 personas.
Día con más afluencia: sábado (2,800 personas)."
```

```text
User: "Cómo va la conciliación de tarjetas esta instancia?"
Hermes: [consulta a API] → "Instancia 14: 92% de cobertura,
S/ 215,430 conciliados, S/ 18,200 pendientes."
```

## Notas

- No necesita consultar BigQuery directamente — toda la inteligencia de
  contexto + generación SQL ya está en el backend de la web
- La API key se configura una vez y Hermes la recuerda entre sesiones
- Ideal para desplegar Hermes en VPS con Docker y conectar via Telegram
