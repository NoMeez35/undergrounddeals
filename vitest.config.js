import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("worker/migrations");

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./worker/wrangler.jsonc" },
        miniflare: {
          // Base vide pour worker/test/migrations.test.js, qui y applique les
          // migrations une à une.
          d1Databases: ["DB_MIGRATIONS"],
          bindings: {
            TEST_MIGRATIONS: migrations,
            SESSION_SECRET: "secret-de-test",
            STEAM_API_KEY: "cle-de-test",
          },
        },
      }),
    ],
    test: {
      include: ["worker/test/**/*.test.js", "app/test/**/*.test.js"],
      setupFiles: ["./worker/test/appliquer-migrations.js"],
    },
  };
});
