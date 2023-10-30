import type { JestConfigWithTsJest } from 'ts-jest'

// This is the horrible hack needed to test ES modules with Jest
const esModules = [
    'rdf-validate-shacl',
    'clownface',
    '@rdfjs',
    '@vocabulary',
    'rdf-validate-datatype',
    '@tpluscode'
].join('|')

const config: JestConfigWithTsJest = {
    /*projects: [
        '<rootDir>/packages/*'
    ],*/
    extensionsToTreatAsEsm: ['.ts'],
    preset: 'ts-jest/presets/js-with-babel-esm',
    verbose: true,
    clearMocks: true,
    testEnvironment: 'node',
    transformIgnorePatterns: [
        `<rootDir>/node_modules/(?!(${esModules})/)`
    ]
}

export default config;