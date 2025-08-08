import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, "../../../.env.local") });

/**
 * Get test credentials with fallback to legacy .test-credentials file
 * Prefers environment variables over file-based credentials
 */
export async function getTestCredentials() {
  // First, try environment variables (preferred method)
  if (process.env.VITE_TEST_IDENTIFIER && process.env.VITE_TEST_PASSWORD) {
    console.log("✅ Using credentials from environment variables");
    return {
      identifier: process.env.VITE_TEST_IDENTIFIER,
      password: process.env.VITE_TEST_PASSWORD,
    };
  }

  // Fallback to legacy .test-credentials file
  console.log(
    "⚠️  No environment variables found, falling back to .test-credentials file",
  );
  console.log("   Please migrate to using .env.local (see .env.example)");

  try {
    const credentialsPath = path.join(__dirname, "../../../.test-credentials");
    const credentialsContent = await fs.readFile(credentialsPath, "utf8");

    const lines = credentialsContent.split("\n");
    let identifier = "";
    let password = "";

    for (const line of lines) {
      if (line.startsWith("TEST_USER=")) {
        identifier = line.split("=")[1]?.trim() || "";
      } else if (line.startsWith("TEST_PASS=")) {
        password = line.split("=")[1]?.trim() || "";
      }
    }

    if (!identifier || !password) {
      throw new Error("Invalid .test-credentials file format");
    }

    return { identifier, password };
  } catch (error) {
    throw new Error(
      "Test credentials not found. Please either:\n" +
        "1. Copy .env.example to .env.local and fill in your credentials, or\n" +
        "2. Create a .test-credentials file with TEST_USER and TEST_PASS",
    );
  }
}
