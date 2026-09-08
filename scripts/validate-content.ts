import { checkContent, loadContent } from './lib/content'

const { content, problems } = loadContent()
problems.push(...checkContent(content))

const errors = problems.filter((p) => p.level === 'error')
const warnings = problems.filter((p) => p.level === 'warning')
for (const p of [...errors, ...warnings]) console.log(`${p.level === 'error' ? 'ERROR  ' : 'warning'} ${p.where}: ${p.message}`)
console.log(`\n${content.items.length} items, ${content.scenarios.length} scenarios, ${content.cities.length} cities; ${errors.length} errors, ${warnings.length} warnings`)
if (errors.length) process.exit(1)
