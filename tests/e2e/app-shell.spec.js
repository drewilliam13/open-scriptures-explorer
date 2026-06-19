import { expect, test } from "@playwright/test";

test("opens the mobile shell and switches tabs", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");

  await expect(main.getByText("Open Scripture Explorer")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bible Reader" })).toBeVisible();
  await expect(main.getByText("Genesis 1:1", { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("IN THE beginning God created the heaven and the earth.")).toBeVisible();

  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("heading", { name: "Search Scripture" })).toBeVisible();

  await page.getByLabel("Natural language search").fill("eagles wings");
  await page.locator("form").getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Exodus 19:4", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open" }).first().click();
  await expect(page.getByRole("heading", { name: "Bible Reader" })).toBeVisible();
  await expect(page.getByLabel("Tanakh book")).toHaveValue("exo");
  await expect(page.getByLabel("Chapter")).toHaveValue("19");

  await page.goBack();
  await expect(page.getByRole("heading", { name: "Search Scripture" })).toBeVisible();
  await expect(page.getByText("Exodus 19:4", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open" }).first().click();
  await expect(page.getByRole("heading", { name: "Bible Reader" })).toBeVisible();

  await page.getByRole("button", { name: "Bible" }).click();

  await page.getByLabel("Tanakh book").selectOption("exo");
  await page.getByLabel("Chapter").selectOption("19");

  await expect(page.getByText("Exodus 19:4")).toBeVisible();
  await expect(page.getByText("Ye have seen what I did unto the Egyptians")).toBeVisible();

  await page.getByLabel("Tanakh book").selectOption("isa");
  await page.getByLabel("Chapter").selectOption("53");

  await expect(page.getByText("Isaiah 53:1", { exact: true })).toBeVisible();

  await page.getByLabel("Tanakh book").selectOption("mal");
  await page.getByLabel("Chapter").selectOption("3");

  await expect(page.getByText("Malachi 3:24", { exact: true })).toBeVisible();
  await expect(page.getByText("And he shall turn the heart of the fathers to the children")).toBeVisible();
});

test("resets reader URLs when returning to search", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Search" }).click();
  await page.getByLabel("Natural language search").fill("eagles wings");
  await page.locator("form").getByRole("button", { name: "Search" }).click();
  await expect(page.getByText("Exodus 19:4", { exact: true })).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Open" }).first().click();
  await expect(page).toHaveURL(/\/read\/exo\/19$/);

  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("heading", { name: "Search Scripture" })).toBeVisible();
  await expect(page).toHaveURL("/");
});

test("opens a direct reader route", async ({ page }) => {
  await page.goto("/read/isa/53");

  await expect(page.getByRole("heading", { name: "Bible Reader" })).toBeVisible();
  await expect(page.getByText("Isaiah 53:1", { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel("Tanakh book")).toHaveValue("isa");
  await expect(page.getByLabel("Chapter")).toHaveValue("53");
});

test("returns not found for invalid reader routes", async ({ page }) => {
  const response = await page.goto("/read/gen/999");

  expect(response?.status()).toBe(404);
});
