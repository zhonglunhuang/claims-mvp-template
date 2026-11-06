// 線上版本號：Render 部署時會給 RENDER_GIT_COMMIT（這次部署的 commit），取前 7 碼；本機沒有，顯示 dev。
// 啟動的 Log、健康檢查（development 以外）與頁尾的「版本」都用這個值。
export function getVersion(env: NodeJS.ProcessEnv = process.env): string {
  const commit = env.RENDER_GIT_COMMIT?.trim();
  return commit ? commit.slice(0, 7) : 'dev';
}
