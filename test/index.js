import path from 'path'
import fs from 'fs'
import assert from 'assert'
import { transformFileSync } from 'babel-core'
import plugin from '../src'

const fixturesDir = path.join(__dirname, 'fixtures')

describe('Ambient decorator plugin', () => {
  fs.readdirSync(fixturesDir).map((exampleFileName) => {
    const exampleName = exampleFileName.split('-').join(' ')

    it(`transpiles "${exampleName}" example`, () => {

      const fixtureDir = path.join(fixturesDir, exampleFileName)
      const actualPath = path.join(fixtureDir, 'actual.js')
      const actual = transformFileSync(actualPath).code

      const expected = fs.readFileSync(
        path.join(fixtureDir, 'expected.js')
      ).toString()

      assert.equal(actual.trim(), expected.trim())
    })
  })
})
