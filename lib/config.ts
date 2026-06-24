import db from "./db";

// Mapping from config key → env var name (fallback)
const ENV_MAP: Record<string, string> = {
  google_client_id:       "GOOGLE_CLIENT_ID",
  google_client_secret:   "GOOGLE_CLIENT_SECRET",
  auth_secret:            "NEXTAUTH_SECRET",
  openweathermap_api_key: "OPENWEATHERMAP_API_KEY",
  weather_city:           "WEATHER_CITY",
  anthropic_api_key:      "ANTHROPIC_API_KEY",
  ollama_url:             "OLLAMA_URL",
  github_token:           "GITHUB_TOKEN",
  reddit_client_id:       "REDDIT_CLIENT_ID",
  reddit_client_secret:   "REDDIT_CLIENT_SECRET",
  n8n_url:                "N8N_URL",
  n8n_api_key:            "N8N_API_KEY",
  dashboard_title:        "DASHBOARD_TITLE",
  terminal_user:          "TERMINAL_USER",
  terminal_host:          "TERMINAL_HOST",
  terminal_home:          "TERMINAL_HOME",
};

// Secret keys whose values are masked in the GET /api/config response
export const SECRET_KEYS = new Set([
  "google_client_secret",
  "auth_secret",
  "openweathermap_api_key",
  "anthropic_api_key",
  "github_token",
  "reddit_client_secret",
  "n8n_api_key",
]);

export function getConfig(key: string): string {
  try {
    const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key) as { value: string } | null;
    if (row?.value) return row.value;
  } catch {}
  return process.env[ENV_MAP[key] ?? ""] ?? "";
}

export function setConfig(key: string, value: string): void {
  db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run(key, value);
}

export function getAllConfig(): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM config").all() as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const key of Object.keys(ENV_MAP)) {
    result[key] = getConfig(key);
  }
  // Override with DB values (already done via getConfig, but make explicit)
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}
