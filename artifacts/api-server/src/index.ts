import app from "./app";
import { logger } from "./lib/logger";
import { syncDefaultSystemPrompts } from "./lib/ai-system-prompts";
import { seedDefaultProviders } from "./lib/seed-providers";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  syncDefaultSystemPrompts()
    .then(() => logger.info("System prompts synced to latest defaults"))
    .catch((e) => logger.warn({ err: e }, "Failed to sync system prompt defaults"));

  seedDefaultProviders()
    .then(() => logger.info("Default AI providers seeded"))
    .catch((e) => logger.warn({ err: e }, "Failed to seed default AI providers"));
});
