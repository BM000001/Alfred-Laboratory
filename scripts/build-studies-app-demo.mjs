// Allow only a static Laboratory preview with a dedicated storage and service-worker scope.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const env = {...process.env, ALFRED_PAGES_BASE:'/Alfred-Laboratory/studies-app/',
  VITE_STUDIES_AI_ORIGIN:'', VITE_GOOGLE_CALENDAR_CLIENT_ID:'', VITE_GOOGLE_APPS_SCRIPT_URL:''};
execFileSync('npm',['run','build:pages'],{env,stdio:'inherit'});
const html = readFileSync('dist/index.html','utf8');
if (!html.includes(env.ALFRED_PAGES_BASE + 'assets/')) throw new Error('Base inesperada.');
const policy = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
writeFileSync('dist/index.html',html.replace('<head>', '<head>\n<meta http-equiv="Content-Security-Policy" content="'+policy+'">'));
