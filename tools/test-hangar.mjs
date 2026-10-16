// Daily checks stay on Hangar; browser startup is an explicit second step.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const mode = process.argv[2] || '--quick';
const quick = ['hangar', 'show-themes', 'light-choreography', 'signals', 'audio', 'quality', 'steady', 'setup', 'resources', 'check', 'serve'];
if (!['--quick', '--audio', '--browser', '--extended'].includes(mode)) throw new Error('Use --quick, --audio, --browser or --extended');
const files = mode === '--browser' ? ['tests/hangar-page.test.mjs'] : mode === '--extended' ? ['tests/'] : mode === '--audio' ? ['tests/listen.test.mjs', 'tests/mix.test.mjs'] : quick.map(name => `tests/${name}.test.mjs`);
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], { cwd: root, stdio: 'inherit', env: { ...process.env, SV_PRODUCT_ONLY: '1' } });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
