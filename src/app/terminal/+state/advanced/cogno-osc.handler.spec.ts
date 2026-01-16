import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalMockFactory } from '../../../../__test__/mocks/terminal-mock.factory';
import { CognoOscHandler } from './cogno-osc.handler';
import { SessionState } from '../session.state';
import { AppBus } from '../../../app-bus/app-bus';
import { ShellType } from '../../../config/+models/config';
import { Terminal } from '@xterm/xterm';

describe('CognoOscHandler', () => {
  let handler: CognoOscHandler;
  let mockTerminal: Terminal;
  let sessionState: SessionState;
  let mockBus: AppBus;
  const terminalId = 'test-terminal-id';

  beforeEach(() => {
    mockBus = new AppBus();
    sessionState = new SessionState(terminalId, 'Bash' as any, mockBus);
    handler = new CognoOscHandler(sessionState);
    mockTerminal = TerminalMockFactory.createTerminal();
  });

  it('should register OSC handler for 733', () => {
    handler.registerTerminal(mockTerminal);
    expect(mockTerminal.parser.registerOscHandler).toHaveBeenCalledWith(733, expect.any(Function));
  });

  it('should update sessionState.isCommandRunning to false when OSC 733 is received', () => {
    handler.registerTerminal(mockTerminal);
    sessionState.isCommandRunning = true;

    const oscHandler = vi.mocked(mockTerminal.parser.registerOscHandler).mock.calls[0][1];
    const result = oscHandler('some-title');

    expect(sessionState.isCommandRunning).toBe(false);
    expect(result).toBe(true);
  });

  it('should dispose registered OSC handler', () => {
    const disposeSpy = vi.fn();
    vi.mocked(mockTerminal.parser.registerOscHandler).mockReturnValue({ dispose: disposeSpy });

    handler.registerTerminal(mockTerminal);
    handler.dispose();

    expect(disposeSpy).toHaveBeenCalled();
  });
});
