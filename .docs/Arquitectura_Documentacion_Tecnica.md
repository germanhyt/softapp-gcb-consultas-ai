# Arquitectura y Documentación Técnica
**Proyecto:** Consultas Refugio v2
**Fecha:** 2026-05-15

## 1. Visión General
Consultas Refugio v2 es un asistente inteligente diseñado para El Refugio, un centro gastronómico/comercial. Proporciona funcionalidades avanzadas de análisis y conciliación de datos, integrando modelos de Inteligencia Artificial (Gemini, Claude, GPT, DeepSeek) con bases de datos en la nube (BigQuery) y orígenes de datos locales/externos.

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
│   │   │   ├── instancias/# Manejo de instancias de conciliación
│   │   │   └── scheduler/ # Endpoints para tareas programadas
│   │   ├── auditoria/   # Módulo de auditoría
│   │   ├── instancias/  # Módulo de gestión de conciliación
│   │   ├── proyecciones/# Módulo de proyecciones
│   │   └── reporteria/  # Módulo de reportería avanzada
│   ├── components/      # Componentes React reutilizables
│   │   ├── assistant/   # UI del chatbot y asistencia
│   │   ├── dashboard/   # Tarjetas de KPIs, gráficos, filtros
│   │   └── ui/          # Componentes base (Botones, inputs)
│   ├── contexts/        # Estados globales (React Context)
│   │   └── chat-context.tsx # Manejo del estado del chat global
│   └── lib/             # Lógica de negocio y utilidades
│       ├── ai/          # Configuración, prompts y proveedores de IA
│       ├── data/        # Clientes de BD (BigQuery, Cuadre Tarjetas)
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

## 5. Despliegue y Contenedorización
El proyecto está preparado para producción usando Docker. Usa un `Dockerfile` multi-stage basado en `node:20-alpine` y Docker Compose para orquestación. Next.js está configurado para output `standalone`, optimizando el tamaño final de la imagen.
