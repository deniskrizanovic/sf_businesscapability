import { test as setup } from '@playwright/test';
import * as path from 'path';

const editorAuthFile = path.join(__dirname, '../.auth/editor.json');
const viewerAuthFile = path.join(__dirname, '../.auth/viewer.json');

async function loginAs(
    page: import('@playwright/test').Page,
    username: string,
    password: string,
    baseURL: string
) {
    await page.goto('https://test.salesforce.com');
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Log In to Sandbox' }).click();
    await page.waitForURL(/lightning/, { timeout: 60000 });
}

setup('authenticate as editor', async ({ page, baseURL }) => {
    await loginAs(
        page,
        process.env.SF_EDITOR_USERNAME!,
        process.env.SF_EDITOR_PASSWORD!,
        baseURL!
    );
    await page.context().storageState({ path: editorAuthFile });
});

setup('authenticate as viewer', async ({ page, baseURL }) => {
    await loginAs(
        page,
        process.env.SF_VIEWER_USERNAME!,
        process.env.SF_VIEWER_PASSWORD!,
        baseURL!
    );
    await page.context().storageState({ path: viewerAuthFile });
});
