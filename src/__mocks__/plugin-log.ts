export const warn = jest.fn((msg: string) => Promise.resolve(() => console.warn(`test: ${msg}`)));
export const debug = jest.fn((msg: string) => Promise.resolve(() => console.debug(`test: ${msg}`)));
export const trace = jest.fn((msg: string) => Promise.resolve(() => console.trace(`test: ${msg}`)));
export const info = jest.fn((msg: string) => Promise.resolve(() => console.info(`test: ${msg}`)));
export const error = jest.fn((msg: string) => Promise.resolve(() => console.error(`test: ${msg}`)));
export const attachConsole = jest.fn();
export const attachLogger = jest.fn();
