import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": new URL("./test/server-only-stub.ts", import.meta.url).pathname },
  },
  test: {
    include: ["src/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://dental:dental@localhost:5432/dental_test",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
      BETTER_AUTH_URL: "http://localhost:3100",
      LOG_LEVEL: "fatal",
      UPLOAD_DIR: "./storage/test-uploads",
    },
  },
})
