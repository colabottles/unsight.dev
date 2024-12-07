import { Octokit } from '@octokit/rest'

import { getLabels, type Issue } from '../../utils/github'

const labelsToExclude = ['documentation', 'invalid', 'enhancement']
const knownBots = new Set(['renovate', 'renovate[bot]'])

const allowedRepos = ['nuxt/nuxt', 'vuejs/core', 'vitejs/vite', 'nitrojs/nitro', 'danielroe/beasties', 'unjs/h3', 'unjs/c12', 'unjs/unenv', 'unjs/ofetch']

export default defineCachedEventHandler(async (event) => {
  const [owner, repo] = getRouterParam(event, 'repo')?.split('/') || []
  if (!owner || !repo) {
    throw createError({
      status: 400,
      message: 'Invalid repository',
    })
  }

  if (!allowedRepos.includes(`${owner}/${repo}`)) {
    throw createError({
      status: 400,
      message: 'Repository not allowed',
    })
  }

  const options = owner !== 'unjs' ? { auth: useRuntimeConfig(event).github.token } : {}
  const octokit = new Octokit(options)

  // TODO: date/state filters?
  const issues = await octokit.paginate(octokit.issues.listForRepo, {
    owner,
    repo,
    state: 'open',
    per_page: 100,
  })

  return issues.filter(issue =>
    !issue.pull_request
    && (!issue.user || !knownBots.has(issue.user.login))
    && !getLabels(issue).some(label => labelsToExclude.some(l => label === l || label.startsWith(l))),
  ) satisfies Issue[]
}, {
  swr: true,
  getKey(event) {
    const [owner, repo] = getRouterParam(event, 'repo')?.split('/') || []
    return `issues:${owner}:${repo}`.toLowerCase()
  },
  maxAge: 60 * 60 * 1000,
  staleMaxAge: 60 * 60 * 1000,
  shouldBypassCache: event => getHeader(event, 'force') === 'true',
})
