import { defineConfig } from '@neon/config/v1'

/**
 * The site is a static export on GitHub Pages, so runtime bits live here:
 * a dedicated Neon project ("portfolio", aws-us-east-1) whose Postgres holds
 * the blog like-counters and whose Function serves them. `neon deploy` from
 * this repo applies the declaration; DATABASE_URL is injected at runtime.
 */
export default defineConfig({
  functions: {
    likes: {
      name: 'blog likes api',
      source: 'neon/likes/index.ts',
    },
  },
})
