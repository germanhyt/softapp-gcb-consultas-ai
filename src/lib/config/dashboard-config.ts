import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";

export interface DashboardConfig {
  /** Si es true, el dashboard no muestra negocios con ventas 0 en el rango seleccionado. */
  hideNegociosSinVentas: boolean;
}

function findProjectRootFromCwd(startDir: string): string {
  let currentDir = startDir;
  while (true) {
    const hasPackageJson = existsSync(join(currentDir, "package.json"));
    const hasSrcDir = existsSync(join(currentDir, "src"));
    if (hasPackageJson && hasSrcDir) return currentDir;
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) return startDir;
    currentDir = parentDir;
  }
}

const PROJECT_ROOT = findProjectRootFromCwd(process.cwd());
const CONFIG_DIR = join(PROJECT_ROOT, "data");
const CONFIG_PATH = join(CONFIG_DIR, "dashboard-config.json");

const DEFAULT_CONFIG: DashboardConfig = {
  hideNegociosSinVentas: true,
};

export function readDashboardConfig(): DashboardConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(raw) as Partial<DashboardConfig> | null;
      if (parsed && typeof parsed === "object") {
        return {
          hideNegociosSinVentas:
            typeof parsed.hideNegociosSinVentas === "boolean"
              ? parsed.hideNegociosSinVentas
              : DEFAULT_CONFIG.hideNegociosSinVentas,
        };
      }
    }
  } catch (err) {
    console.error("[DashboardConfig] read error:", err);
  }
  return { ...DEFAULT_CONFIG };
}

export function writeDashboardConfig(config: DashboardConfig): void {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error("[DashboardConfig] write error:", err);
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `No se pudo guardar la configuración del dashboard (${detail}). Ruta: ${CONFIG_PATH}`,
    );
  }
}
