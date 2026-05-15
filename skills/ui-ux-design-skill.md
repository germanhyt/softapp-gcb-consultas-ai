# Skill: UI/UX Design System - El Refugio

Este documento define la base de conocimiento ("skill") de UI/UX para el proyecto **El Refugio**. Utiliza este documento como referencia principal al diseñar, maquetar o refactorizar componentes de la interfaz de usuario, garantizando consistencia, accesibilidad y una estética moderna (Dark Mode / Premium).

## 1. Identidad Visual y Estética Global
- **Estilo Principal:** Dark Mode por defecto. Diseño moderno, minimalista, con toques vibrantes para resaltar las acciones principales.
- **Sensación:** Premium, limpio, con micro-interacciones sutiles y bordes redondeados suaves (squircle o border-radius medio/alto).
- **Fondos (Backgrounds):** Se utilizarán tonos oscuros profundos (ej. `#111311` o `#181A18`) para crear contraste con las tarjetas y paneles de contenido. Las tarjetas usarán variaciones sutiles de gris/verde oscuro.

## 2. Paleta de Colores

Los colores del sistema se dividen en 4 categorías principales. Deben ser implementados como variables CSS globales (`:root` o a través de Tailwind CSS).

| Nombre | Hexadecimal | Uso Principal |
| :--- | :--- | :--- |
| **Primary** | `#38D149` | Acciones principales (CTAs), botones primarios, switches activos, íconos de estado positivo, barras de progreso y elementos clave. El texto sobre este color debe ser oscuro para máximo contraste. |
| **Secondary** | `#FF9F43` | Alertas medias, botones secundarios o de advertencia, badges de estado (ej. "En proceso" o "Pendiente"). |
| **Tertiary** | `#D65454` | Acciones destructivas (Borrar, Cancelar), mensajes de error o estados críticos. |
| **Neutral** | `#717A6D` | Textos secundarios, descripciones, bordes de inputs inactivos, divisores y backgrounds de botones inactivos/deshabilitados. |

*(Nota: En Tailwind, estas variables deben configurarse en `tailwind.config.ts` extendiendo los colores bajo `primary`, `secondary`, `destructive/tertiary`, y `muted/neutral`).*

## 3. Tipografía
- **Fuente Principal:** `Hanken Grotesk`
- **Jerarquía:**
  - **Headline (H1, H2, H3):** Bold o SemiBold. Tamaños grandes para títulos de pantallas y tarjetas.
  - **Body (P, Span):** Regular o Medium. Usado en párrafos, lectura continua y descripciones de elementos.
  - **Label (Botones, Badges, Inputs):** Medium o SemiBold. Textos pequeños pero altamente legibles en mayúsculas o capitalizados.

## 4. Componentes Clave

### Botones (Buttons)
1. **Primary:** Fondo `#38D149`, texto `#000000` o `#0F172A` (oscuro). Sin bordes. 
2. **Secondary / Neutral:** Fondo oscuro (gris verdoso o translúcido), texto blanco o claro.
3. **Inverted:** Fondo crema/blanco suave (`#F8F9FA` aprox), texto oscuro.
4. **Outlined:** Sin fondo (transparente), borde `#38D149` o neutral, texto del mismo color del borde.
5. **Icon Buttons:** Fondos circulares o cuadrados con esquinas muy redondeadas. Estado activo (ej. navegación) toma fondo `#38D149` y el ícono en oscuro.

### Campos de Entrada (Inputs)
- **Search & Text Inputs:** Fondo oscuro (más claro que el background general pero más oscuro que las tarjetas, ej. `#2A2E2A`), sin borde fuerte, ícono a la izquierda (Search). Borde sutil `#717A6D` o transparente que cambia a `#38D149` al recibir foco (focus ring).
- **Esquinas:** `rounded-lg` o `rounded-xl`.

### Tarjetas (Cards)
- Fondo oscuro ligeramente distinto al fondo de la pantalla.
- Elevación nula o sombras suaves (drop-shadow muy sutil).
- Separadores internos usando el color `Neutral` con opacidad reducida (`#717A6D33`).

### Badges / Labels
- Fondos claros o translúcidos del color base con texto en el color sólido, o bien botones pequeños con color de fondo completo.
- Ejemplos: Label verde (éxito/activo), label rojo (error/eliminar), label naranja (edición/alerta).

## 5. Implementación en Código (Tailwind CSS)
Asegúrate de extender la configuración para reflejar este design system:

```javascript
// tailwind.config.ts o similar
theme: {
  extend: {
    fontFamily: {
      sans: ['var(--font-hanken-grotesk)', 'sans-serif'],
    },
    colors: {
      primary: {
        DEFAULT: '#38D149',
        foreground: '#111311', // Texto sobre el primary
      },
      secondary: {
        DEFAULT: '#FF9F43',
        foreground: '#FFFFFF',
      },
      tertiary: {
        DEFAULT: '#D65454',
        foreground: '#FFFFFF',
      },
      neutral: {
        DEFAULT: '#717A6D',
        foreground: '#E2E8F0',
      },
      background: '#121412', // Color de fondo principal
      card: '#181B18', // Fondo de contenedores/tarjetas
    }
  }
}
```

## 6. Micro-interacciones (Animaciones)
- Agrega un sutil `hover:scale-[1.02]` y `transition-all duration-200` en los botones y tarjetas.
- Los inputs deben tener un `focus:ring-2 focus:ring-primary/50` suave.
- Las barras de navegación inferiores deben iluminar el icono activo o mostrar un fondo verde (`#38D149`) de forma animada.

---
> **Instrucción para el LLM:** Siempre que debas generar o refactorizar un componente de React/Next.js para el usuario, aplica estos estilos, colores y tipografía de manera estricta y evita el uso de colores por defecto de Tailwind como `blue-500` o `red-500`. Usa en su lugar los colores personalizados definidos aquí.
