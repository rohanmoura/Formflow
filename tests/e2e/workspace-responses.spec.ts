import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

const ownerEmail = process.env.E2E_CLERK_USER_EMAIL;
const otherEmail = process.env.E2E_CLERK_OTHER_USER_EMAIL;

test("respondent email, duplicate prevention, and response pagination work", async ({ browser }) => {
  test.skip(!ownerEmail, "Set E2E_CLERK_USER_EMAIL to run authenticated respondent and pagination coverage.");
  const ownerContext = await browser.newContext();
  const respondentContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const respondentPage = await respondentContext.newPage();
  let formId = "";

  try {
    await ownerPage.goto("/");
    await clerk.signIn({ page: ownerPage, emailAddress: ownerEmail! });
    const title = `E2E response form ${crypto.randomUUID()}`;
    const create = await ownerPage.request.post("/api/forms", { data: {
      title,
      description: "Automated submission and pagination test.",
      limitOneResponsePerEmail: true,
      fields: [
        { type: "EMAIL", label: "Contact email", required: true, position: 0 },
        { type: "SHORT_TEXT", label: "Favorite color", required: true, position: 1 }
      ]
    } });
    expect(create.status()).toBe(201);
    const created = await create.json();
    formId = created.form.id as string;
    expect(created.form.limitOneResponsePerEmail).toBe(true);
    expect((await ownerPage.request.patch(`/api/forms/${formId}`, { data: { status: "PUBLISHED" } })).ok()).toBeTruthy();
    const publicForm = await (await ownerPage.request.get(`/api/public/forms/${created.form.slug}`)).json();
    expect(publicForm.form.limitOneResponsePerEmail).toBe(true);
    expect((await respondentPage.request.get(`/api/forms/${formId}`)).status()).toBe(401);
    expect((await respondentPage.request.get(`/api/forms/${formId}/submissions`)).status()).toBe(401);

    const respondentEmail = `response-${crypto.randomUUID()}@example.com`;
    await respondentPage.goto(`/f/${created.form.slug}`);
    await respondentPage.getByLabel("Contact email").fill(respondentEmail);
    await respondentPage.getByLabel("Favorite color").fill("purple");
    await respondentPage.getByRole("button", { name: "Submit response" }).click();
    await expect(respondentPage.getByRole("heading", { name: "Thank you for responding" })).toBeVisible();

    await respondentPage.goto(`/f/${created.form.slug}`);
    await respondentPage.getByLabel("Contact email").fill(respondentEmail.toUpperCase());
    await respondentPage.getByLabel("Favorite color").fill("green");
    await respondentPage.getByRole("button", { name: "Submit response" }).click();
    await expect(respondentPage.getByText("A response from this email has already been recorded.")).toBeVisible();

    const responseList = await ownerPage.request.get(`/api/forms/${formId}/submissions?page=1&pageSize=10`);
    expect(responseList.ok()).toBeTruthy();
    const listed = await responseList.json();
    expect(listed.pagination.total).toBe(1);
    expect(listed.submissions[0].respondentEmail).toBe(respondentEmail.toLowerCase());

    const firstPageResponse = await ownerPage.request.get(`/api/forms/${formId}/submissions?page=1&pageSize=1`);
    const firstPage = await firstPageResponse.json();
    expect(firstPage.submissions).toHaveLength(1);
    expect(firstPage.pagination.total).toBe(1);
    expect(firstPage.pagination.totalPages).toBe(1);
    const oversizedPage = await (await ownerPage.request.get(`/api/forms/${formId}/submissions?page=999999&pageSize=10000`)).json();
    expect(oversizedPage.pagination.pageSize).toBeLessThanOrEqual(100);
    expect(oversizedPage.pagination.page).toBe(oversizedPage.pagination.totalPages || 1);
  } finally {
    if (formId) await ownerPage.request.delete(`/api/forms/${formId}`).catch(() => undefined);
    await ownerContext.close();
    await respondentContext.close();
  }
});

test("another signed-in user cannot read or alter an owner's form or responses", async ({ browser }) => {
  test.skip(!ownerEmail || !otherEmail, "Set both Clerk test-user email variables for cross-user ownership coverage.");
  const ownerContext = await browser.newContext();
  const otherContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const otherPage = await otherContext.newPage();
  let formId = "";
  try {
    await ownerPage.goto("/");
    await clerk.signIn({ page: ownerPage, emailAddress: ownerEmail! });
    await otherPage.goto("/");
    await clerk.signIn({ page: otherPage, emailAddress: otherEmail! });
    const create = await ownerPage.request.post("/api/forms", { data: { title: `E2E isolation ${crypto.randomUUID()}`, fields: [{ type: "SHORT_TEXT", label: "Question", required: true, position: 0 }] } });
    expect(create.status()).toBe(201);
    formId = (await create.json()).form.id as string;
    expect((await otherPage.request.get(`/api/forms/${formId}`)).status()).toBe(404);
    expect((await otherPage.request.get(`/api/forms/${formId}/submissions`)).status()).toBe(404);
    expect((await otherPage.request.delete(`/api/forms/${formId}`)).status()).toBe(404);
    expect((await ownerPage.request.get(`/api/forms/${formId}`)).status()).toBe(200);
  } finally {
    if (formId) await ownerPage.request.delete(`/api/forms/${formId}`).catch(() => undefined);
    await ownerContext.close();
    await otherContext.close();
  }
});

test("public submission endpoint throttles repeated attempts", async ({ request }) => {
  const rateSlug = `e2e-rate-${crypto.randomUUID()}`;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const response = await request.post(`/api/public/forms/${rateSlug}/submissions`, { data: { answers: [] } });
    expect(response.status()).toBe(404);
  }
  const rateLimited = await request.post(`/api/public/forms/${rateSlug}/submissions`, { data: { answers: [] } });
  expect(rateLimited.status()).toBe(429);
});
