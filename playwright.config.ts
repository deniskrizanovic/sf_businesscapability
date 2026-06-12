import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
    testDir: './tests/e2e',
    globalSetup: './tests/e2e/global-setup.ts',
    globalTeardown: './tests/e2e/global-teardown.ts',
    fullyParallel: false,
    // workers: 2 lets the `editor` and `viewer` projects run concurrently. They authenticate
    // as different users, so the same-user UI cross-talk listed in 09-e2e-test-architecture.md §7
    // does not apply across projects. Spec files within each project remain serial because
    // fullyParallel is false. Revert to workers: 1 if cross-project flake returns.
    workers: 2,
    retries: 1,
    timeout: 60_000,
    expect: { timeout: 10_000 },
    reporter: [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
    use: {
        baseURL: process.env.SF_BASE_URL,
        trace: 'on-first-retry',
        actionTimeout: 15_000,
        navigationTimeout: 30_000,
        testIdAttribute: 'data-id',
    },
    projects: [
        { name: 'setup', testMatch: /auth\.setup\.ts/ },
        {
            name: 'editor',
            grep: /editor project/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'tests/e2e/.auth/editor.json',
            },
            dependencies: ['setup'],
        },
        {
            name: 'viewer',
            grep: /viewer project/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'tests/e2e/.auth/viewer.json',
            },
            dependencies: ['setup'],
        },
    ],
});
