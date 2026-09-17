import { expect, test } from "@playwright/test";

test.describe("Monitored Locations Flow", () => {
  test("redirects unauthenticated users away from /locations", async ({
    page,
  }) => {
    await page.goto("/locations");

    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("allows user to sign up, navigate to locations, and add a monitored location", async ({
    page,
  }) => {
    // Intercept geocoding API to ensure deterministic E2E test without depending on Census uptime
    await page.route("**/api/locations/geocode", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          result: {
            matchedAddress: "4600 SILVER HILL RD, WASHINGTON, DC, 20233",
            latitude: 38.845053,
            longitude: -76.928366,
          },
        }),
      });
    });

    const uniqueEmail = `testuser_${Date.now()}@example.com`;
    const password = "ValidPassword123!";

    // Sign up
    await page.goto("/sign-up");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    // Should land on dashboard
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(`Signed in as ${uniqueEmail}`)).toBeVisible();

    // Click Manage Locations
    await page.getByRole("link", { name: "Manage Locations" }).click();
    await expect(page).toHaveURL(/\/locations$/);
    await expect(
      page.getByRole("heading", { name: "Monitored Locations" }),
    ).toBeVisible();

    // Fill in add location form
    await page.getByLabel(/Label/i).fill("HQ Office");
    await page
      .getByLabel(/US Address/i)
      .fill("4600 Silver Hill Rd, Washington, DC 20233");

    // Click Preview
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByText("Census Matched Location:")).toBeVisible();
    await expect(
      page.getByText("4600 SILVER HILL RD, WASHINGTON, DC, 20233"),
    ).toBeVisible();

    // Save Location
    await page.getByRole("button", { name: "Save Location" }).click();
    await expect(
      page.getByText('Location "HQ Office" added successfully.'),
    ).toBeVisible();

    // Verify it is listed in the user's saved locations
    await expect(
      page.getByRole("heading", { name: "HQ Office", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();
  });
});
