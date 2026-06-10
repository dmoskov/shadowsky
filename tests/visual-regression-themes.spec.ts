import { expect, test } from "@playwright/test";

// Theme-matrix baselines for the design-token system. One tokens.mjs edit
// restyles the whole app, so these snapshots catch unintended blast radius
// across light, dark, and high-contrast themes. Regenerate after an
// intentional design change with:
//   npx playwright test visual-regression-themes --update-snapshots

const themes = [
  { name: "light", setup: "" },
  { name: "dark", setup: "dark" },
  { name: "high-contrast-light", setup: "hc" },
  { name: "high-contrast-dark", setup: "dark hc" },
] as const;

test.describe("Design Token Themes - Landing Page", () => {
  for (const theme of themes) {
    test(`landing page – ${theme.name}`, async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await page.evaluate((setup) => {
        const root = document.documentElement;
        if (setup.includes("dark")) {
          root.classList.add("dark");
          root.dataset.theme = "dark";
        }
        if (setup.includes("hc")) root.dataset.highContrast = "true";
      }, theme.setup);
      await page.waitForTimeout(400);
      await expect(page).toHaveScreenshot(`landing-${theme.name}.png`, {
        fullPage: false,
        animations: "disabled",
      });
    });
  }
});
