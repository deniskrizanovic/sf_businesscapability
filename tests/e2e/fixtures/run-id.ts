import * as fs from 'fs';
import * as path from 'path';

export function getRunId(): string {
    return fs.readFileSync(path.resolve('tests/e2e/.run_id'), 'utf-8').trim();
}
