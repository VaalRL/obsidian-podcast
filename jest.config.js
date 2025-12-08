module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
	testMatch: [
		'**/__tests__/**/*.ts',
		'**/?(*.)+(spec|test).ts'
	],
	transform: {
		'^.+\\.ts$': ['ts-jest', {
			tsconfig: {
				moduleResolution: 'node',
				esModuleInterop: true,
				allowSyntheticDefaultImports: true,
				skipLibCheck: true
			}
		}]
	},
	collectCoverageFrom: [
		'src/**/*.ts',
		'!src/**/*.d.ts',
		'!src/**/__tests__/**',
		'!src/**/index.ts'
	],
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'lcov', 'html'],
	moduleNameMapper: {
		'^obsidian$': '<rootDir>/__mocks__/obsidian.ts'
	},
	setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};
