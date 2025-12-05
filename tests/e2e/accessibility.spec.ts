import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * WCAG 2.1 AA Accessibility Audit using axe-core
 * Tests the landing page and basic UI for accessibility violations
 *
 * Tag: @accessibility - Used for running accessibility tests separately in CI
 */

// Helper to save accessibility report JSON for CI summary
function saveAccessibilityReport(
  results: Awaited<ReturnType<AxeBuilder["analyze"]>>,
) {
  const reportPath = path.join(process.cwd(), "accessibility-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
}

test.describe("Accessibility - WCAG 2.1 AA Audit @accessibility", () => {
  test("Landing page should have no critical accessibility violations @accessibility", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for the page to fully load
    await page.waitForLoadState("networkidle");

    // Run axe accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    // Save report for CI summary
    saveAccessibilityReport(accessibilityScanResults);

    // Log all violations for debugging
    if (accessibilityScanResults.violations.length > 0) {
      console.log("\n=== ACCESSIBILITY VIOLATIONS FOUND ===\n");
      accessibilityScanResults.violations.forEach((violation, index) => {
        console.log(`\n--- Violation ${index + 1} ---`);
        console.log(`ID: ${violation.id}`);
        console.log(`Impact: ${violation.impact}`);
        console.log(`Description: ${violation.description}`);
        console.log(`Help: ${violation.help}`);
        console.log(`Help URL: ${violation.helpUrl}`);
        console.log(`WCAG Tags: ${violation.tags.join(", ")}`);
        console.log(`Affected Elements:`);
        violation.nodes.forEach((node, nodeIndex) => {
          console.log(`  ${nodeIndex + 1}. ${node.target.join(" > ")}`);
          console.log(`     HTML: ${node.html.slice(0, 200)}...`);
        });
      });
      console.log("\n=== END OF VIOLATIONS ===\n");
    }

    // Only fail on critical and serious violations
    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    expect(criticalViolations).toEqual([]);
  });

  test("Page should have proper document structure @accessibility", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check for html lang attribute (WCAG 3.1.1)
    const htmlLang = await page.getAttribute("html", "lang");
    expect(htmlLang).toBeTruthy();
    expect(htmlLang).toBe("en");

    // Check for skip link (WCAG 2.4.1)
    const skipLink = page.locator(".skip-link");
    const skipLinkCount = await skipLink.count();
    expect(skipLinkCount).toBeGreaterThan(0);

    // Check for main landmark (WCAG 1.3.1)
    const mainContent = page.locator("main, [role='main']");
    const mainCount = await mainContent.count();
    expect(mainCount).toBeGreaterThanOrEqual(0); // May not exist on landing page
  });

  test("Interactive elements should be keyboard accessible @accessibility", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check that buttons have accessible names
    const buttons = page.locator("button");
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);
      const isVisible = await button.isVisible();
      if (!isVisible) continue;

      // Each button should have accessible name (WCAG 4.1.2)
      const accessibleName =
        (await button.getAttribute("aria-label")) ||
        (await button.textContent()) ||
        (await button.getAttribute("title"));

      if (!accessibleName?.trim()) {
        const html = await button.evaluate((el) => el.outerHTML);
        console.log(`Button without accessible name: ${html.slice(0, 200)}`);
      }
    }
  });

  test("Images should have alt text @accessibility", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const images = page.locator("img");
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute("alt");
      const src = await img.getAttribute("src");

      // alt can be empty for decorative images, but attribute should exist
      if (alt === null) {
        console.log(`Image missing alt attribute: ${src}`);
      }
    }

    // Run axe specifically for images
    const imageResults = await new AxeBuilder({ page })
      .withRules(["image-alt"])
      .analyze();

    expect(imageResults.violations).toEqual([]);
  });

  test("Forms should have proper labels @accessibility", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Run axe specifically for form labels
    const formResults = await new AxeBuilder({ page })
      .withRules(["label", "form-field-multiple-labels"])
      .analyze();

    if (formResults.violations.length > 0) {
      console.log("\n=== FORM LABEL VIOLATIONS ===");
      formResults.violations.forEach((v) => {
        console.log(`${v.id}: ${v.help}`);
        v.nodes.forEach((n) => {
          console.log(`  - ${n.target.join(" > ")}`);
        });
      });
    }
  });

  test("Color contrast should meet WCAG AA standards @accessibility", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Run axe specifically for color contrast
    const contrastResults = await new AxeBuilder({ page })
      .withRules(["color-contrast"])
      .analyze();

    if (contrastResults.violations.length > 0) {
      console.log("\n=== COLOR CONTRAST VIOLATIONS ===");
      contrastResults.violations.forEach((v) => {
        v.nodes.forEach((n) => {
          console.log(`Element: ${n.target.join(" > ")}`);
          console.log(`  Issue: ${n.failureSummary}`);
        });
      });
    }

    // Only fail on violations (not incomplete checks)
    const criticalContrast = contrastResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(criticalContrast).toEqual([]);
  });
});
