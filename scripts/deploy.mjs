/**
 * gh-pages 배포. `npm run deploy` (build → 이 스크립트) 로 실행한다.
 *
 * Pages가 서빙하는 건 gh-pages 브랜치의 빌드 결과물이라, main에 푸시해도 사이트는 안 바뀐다.
 * 여기서 dist를 통째로 gh-pages에 force push 해야 반영된다 (1~2분 뒤 반영).
 *
 * 원격을 바꾸려면: ROOTLESS_DEPLOY_REMOTE=<url> npm run deploy
 *
 * 이전 버전 보존: `site-<이름>` 태그(옛 gh-pages 커밋)마다 그 빌드를 dist/<이름>/ 에 풀어 같이 올린다.
 * force push로 gh-pages가 덮여도 옛 사이트는 .../rootlessvoicing/<이름>/ 에서 계속 열린다.
 * 새 버전을 남기려면 배포 전에: git tag site-v2 origin/gh-pages && git push origin site-v2
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const REMOTE =
  process.env.ROOTLESS_DEPLOY_REMOTE ?? 'https://github.com/talkingtomoon/rootlessvoicing.git';
const DIST = 'dist';

if (!existsSync(DIST)) {
  console.error(`${DIST}/ 가 없다. 먼저 npm run build 를 돌려라.`);
  process.exit(1);
}

const git = (...args) => execFileSync('git', args, { cwd: DIST, stdio: 'inherit' });

// 이전 버전들을 하위 폴더로 (태그가 로컬에 없으면 원격에서 받아 온다)
try {
  execFileSync('git', ['fetch', '-q', REMOTE, 'refs/tags/site-*:refs/tags/site-*'], { stdio: 'inherit' });
} catch {
  console.warn('site-* 태그를 원격에서 못 받았다 — 로컬 태그만 쓴다');
}
const siteTags = execFileSync('git', ['tag', '-l', 'site-*'], { encoding: 'utf8' }).split(/\s+/).filter(Boolean);
for (const tag of siteTags) {
  const name = tag.slice('site-'.length);
  const dir = `${DIST}/${name}`;
  mkdirSync(dir, { recursive: true });
  const tarball = execFileSync('git', ['archive', '--format=tar', tag], { maxBuffer: 256 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-f', '-', '-C', dir], { input: tarball });
  console.log(`이전 버전 ${tag} → ${dir}/`);
}

// Jekyll 처리를 끄지 않으면 _로 시작하는 파일이 무시될 수 있다
writeFileSync(`${DIST}/.nojekyll`, '');

// dist는 빌드마다 새로 만들어지므로 매번 새 저장소로 시작한다 (히스토리는 main에만 있으면 된다)
git('init', '-q', '-b', 'gh-pages');
git('add', '-A');
git('-c', 'user.name=rootless deploy', '-c', 'user.email=deploy@local', 'commit', '-q', '-m', 'Deploy');
git('push', '--force', '-q', REMOTE, 'gh-pages:gh-pages');

console.log('\n배포함 → https://talkingtomoon.github.io/rootlessvoicing/  (반영까지 1~2분)');
