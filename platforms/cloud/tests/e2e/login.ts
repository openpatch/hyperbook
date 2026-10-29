import type { Page } from "playwright-core";

export async function logIn(page: Page, origin: string, email: string, password: string) {
  await page.goto(`${origin}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(`${origin}/books`);
}

/** Follows a link in the main navigation. */
export async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name, exact: true })
    .click();
}
