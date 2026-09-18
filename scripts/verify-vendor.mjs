import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(await readFile(resolve(root, 'vendor/manifest.json'), 'utf8'))
const project = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))

for (const library of manifest.libraries) {
  const directory = `vendor/${library.name}`
  const dependency = project.dependencies[library.name]
  if (dependency !== `file:${directory}`) {
    throw new Error(`${library.name}: expected local dependency file:${directory}, got ${dependency}`)
  }

  const installedPackage = JSON.parse(await readFile(resolve(root, directory, 'package.json'), 'utf8'))
  if (installedPackage.version !== library.version || installedPackage.license !== library.license) {
    throw new Error(`${library.name}: package version or license differs from vendor/manifest.json`)
  }

  const license = await readFile(resolve(root, library.licenseFile), 'utf8')
  const notice = library.license === 'ISC' ? 'ISC License' : 'MIT License'
  if (!license.includes(notice)) {
    throw new Error(`${library.name}: ${notice} notice is missing`)
  }

  for (const [path, expected] of Object.entries(library.files)) {
    const actual = createHash('sha256').update(await readFile(resolve(root, path))).digest('hex')
    if (actual !== expected) throw new Error(`${path}: sha256 mismatch`)
  }
  console.log(`${library.name}@${library.version}: dependency, license and pinned files verified`)
}
