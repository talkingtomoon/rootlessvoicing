/**
 * gh-pages 배포. `npm run deploy` (build → 이 스크립트) 로 실행한다.
 *
 * Pages가 서빙하는 건 gh-pages 브랜치의 빌드 결과물이라, main에 푸시해도 사이트는 안 바뀐다.
 * 여기서 dist를 통째로 gh-pages에 force push 해야 반영된다 (1~2분 뒤 반영).
 *
 * 원격을 바꾸려면: ROOTLESS_DEPLOY_REMOTE=<url> npm run deploy
 */
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';

const REMOTE =
  process.env.ROOTLESS_DEPLOY_REMOTE ?? 'https://github.com/talkingtomoon/rootlessvoicing.git';
const DIST = 'dist';

if (!existsSync(DIST)) {
  console.error(`${DIST}/ 가 없다. 먼저 npm run build 를 돌려라.`);
  process.exit(1);
}

const git = (...args) => execFileSync('git', args, { cwd: DIST, stdio: 'inherit' });

// Jekyll 처리를 끄지 않으면 _로 시작하는 파일이 무시될 수 있다
writeFileSync(`${DIST}/.nojekyll`, '');

// dist는 빌드마다 새로 만들어지므로 매번 새 저장소로 시작한다 (히스토리는 main에만 있으면 된다)
git('init', '-q', '-b', 'gh-pages');
git('add', '-A');
git('-c', 'user.name=rootless deploy', '-c', 'user.email=deploy@local', 'commit', '-q', '-m', 'Deploy');
git('push', '--force', '-q', REMOTE, 'gh-pages:gh-pages');

console.log('\n배포함 → https://talkingtomoon.github.io/rootlessvoicing/  (반영까지 1~2분)');
