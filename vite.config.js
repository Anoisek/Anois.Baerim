import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { PAGE_INFO, SITE_URL } from './src/seo/pageInfo.js'

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Emits one static HTML file per route in PAGE_INFO (dist/<route>.html, which Pages serves at /<route> without a redirect) with the
// right <title>, meta description, canonical and a plain-text version of the page intro
// inside #root. The SPA replaces #root on load, and the same text is shown to every
// visitor in the collapsed "About this page" block — so crawlers and users get the
// same content, crawlers just don't have to run JS to read it.
// Cloudflare Pages serves an existing file before the `/* /index.html 200` fallback.
function prerenderPages() {
  let outDir
  return {
    name: 'prerender-pages',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const template = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8')
      const en = JSON.parse(fs.readFileSync(path.resolve('src/i18n/locales/en.json'), 'utf8')).pageInfo

      const nav = PAGE_INFO.map(p => `<li><a href="${p.path}">${esc(en[p.key].title)}</a></li>`).join('')

      for (const page of PAGE_INFO) {
        const info = en[page.key]
        const title = page.key === 'home' ? en.siteTitle : `${info.title} – BaerimTools`
        const url = SITE_URL + page.path

        const shell =
          `<main style="max-width:48rem;margin:0 auto;padding:6rem 1.5rem;color:#e5e7eb;line-height:1.6">` +
          `<h1>${esc(info.title)}</h1><p>${esc(info.description)}</p>` +
          (info.body ? `<p>${esc(info.body)}</p>` : '') +
          `<nav><ul>${nav}</ul></nav></main>`

        let html = template
          .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
          .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(info.description)}$2`)
          // Home file doubles as the SPA fallback for every unmatched route (item pages
          // etc.), so it must not carry a canonical; PageMeta sets it at runtime there.
          .replace('</head>', page.path === '/' ? '</head>' : `<link rel="canonical" href="${url}" /></head>`)
          .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
          .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(info.description)}$2`)
          .replace('<div id="root"></div>', `<div id="root">${shell}</div>`)

        const file = page.path === '/' ? path.join(outDir, 'index.html') : path.join(outDir, `${page.path}.html`)
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, html)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    prerenderPages(),
  ],
})
