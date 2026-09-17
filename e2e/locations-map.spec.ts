import { expect, test } from "@playwright/test";

test.describe("Location Map and Proximity Visualization Flow", () => {
  test("allows user to view interactive map, monitoring radius, and nearby FIRMS detections", async ({
    page,
  }) => {
    // 1. Mock geocode API
    await page.route("**/api/locations/geocode", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          result: {
            matchedAddress: "1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500",
            latitude: 38.8977,
            longitude: -77.0365,
          },
        }),
      });
    });

    // 2. Mock detections API
    await page.route("**/api/locations/*/detections*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          location: {
            id: "test-loc-e2e",
            label: "DC Base",
            address: "1600 Pennsylvania Ave NW, Washington, DC",
            latitude: 38.8977,
            longitude: -77.0365,
            monitorRadiusMiles: 25,
            enabled: true,
          },
          windowHours: 24,
          detections: [
            {
              id: "det-mock-1",
              source: "VIIRS_NOAA20_NRT",
              latitude: 38.8451,
              longitude: -76.9284,
              acqTimestamp: new Date().toISOString(),
              satellite: "N20",
              instrument: "VIIRS",
              confidence: "high",
              frp: 18.5,
              daynight: "N",
              distanceMiles: 4.8,
            },
          ],
        }),
      });
    });

    const uniqueEmail = `mapuser_${Date.now()}@example.com`;
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

    // Navigate to locations via dashboard link
    await page.getByRole("link", { name: "Manage Locations" }).click();
    await expect(page).toHaveURL(/\/locations$/);
    await expect(
      page.getByRole("heading", { name: "Monitored Locations" }),
    ).toBeVisible();

    // Add a location
    await page.getByLabel(/Label/i).fill("DC Base");
    await page
      .getByLabel(/US Address/i)
      .fill("1600 Pennsylvania Ave NW, Washington, DC");

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByText("Census Matched Location:")).toBeVisible();

    await page.getByRole("button", { name: "Save Location" }).click();
    await expect(
      page.getByText('Location "DC Base" added successfully.'),
    ).toBeVisible();

    // Verify Map & Detections Section
    await expect(
      page.getByRole("heading", { name: "Interactive Map & Detections" }),
    ).toBeVisible();

    await expect(
      page.getByText("Detected Thermal Anomalies (1)"),
    ).toBeVisible();

    await expect(page.getByText("4.8 mi")).toBeVisible();
    await expect(page.getByText(/N20 \(VIIRS_NOAA20_NRT\)/i)).toBeVisible();

    // Verify factual disclaimer note
    await expect(
      page.getByText(
        /FIRMS observations represent satellite-detected thermal anomalies/i,
      ),
    ).toBeVisible();
  });
});
