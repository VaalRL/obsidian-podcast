// Jest setup file
// This file runs before each test suite

// Mock console methods to reduce noise in test output
global.console = {
	...console,
	// Uncomment to suppress console output during tests
	// log: jest.fn(),
	// debug: jest.fn(),
	// info: jest.fn(),
	// warn: jest.fn(),
	// error: jest.fn(),
};

// Set test timeout
jest.setTimeout(10000);
