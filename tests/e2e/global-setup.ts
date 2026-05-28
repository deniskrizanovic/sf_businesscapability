import * as fs from 'fs';
import * as path from 'path';

export default function globalSetup() {
    const runId = Date.now().toString();
    fs.writeFileSync(path.resolve('tests/e2e/.run_id'), runId, 'utf-8');
}
