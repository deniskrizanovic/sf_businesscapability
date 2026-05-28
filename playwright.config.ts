import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
    testDir: './tests/e2e',
    globalSetup: './tests/e2e/global-setup.ts',
    globalTeardown: './tests/e2e/global-teardown.ts',
    fullyParallel: false,
    reporter: 'html',
    use: {
        baseURL: process.env.SF_BASE_URL,
        trace: 'on-first-retry',
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
