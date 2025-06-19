export const homeDir = jest.fn().mockResolvedValue('/testuser/.cogno');
export const join = jest.fn().mockImplementation((...path: string[]) => path.join('/'));
