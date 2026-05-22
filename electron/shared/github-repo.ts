/** 从 GitHub Releases 页面 URL 解析 owner / repo */
export function parseGithubRepoFromReleasesUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/i)
  if (!match) return null
  return { owner: match[1]!, repo: match[2]!.replace(/\.git$/i, '') }
}

export function githubReleasesApiUrl(owner: string, repo: string): string {
  return `https://api.github.com/repos/${owner}/${repo}/releases`
}
