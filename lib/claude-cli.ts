import { getConfig } from "./config";

export const CLI = process.env.CLAUDE_CLI || "claude";

// Env for the CLI: a long-lived token from Settings → Setup → Claude login (made by
// `claude setup-token`) takes precedence over the auto-refreshing credentials file.
export function cliEnv(): NodeJS.ProcessEnv {
  const token = getConfig("claude_oauth_token");
  return token ? { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: token } : process.env;
}
