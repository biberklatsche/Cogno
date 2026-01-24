import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptMarkerRenderer } from './prompt-renderer';
import { SessionState, Command } from '../../session.state';
import { PromptSegment } from '../../../../config/+models/prompt-config';
import { AppBus } from '../../../../app-bus/app-bus';

describe('PromptMarkerRenderer', () => {
    let sessionState: SessionState;
    let busMock: AppBus;
    let hostElement: HTMLElement;

    beforeEach(() => {
        busMock = { publish: vi.fn() } as unknown as AppBus;
        sessionState = new SessionState('test-term', 'Bash', busMock);
        hostElement = document.createElement('div');
    });

    it('should render default label when no segments are provided', () => {
        const renderer = new PromptMarkerRenderer(sessionState, []);
        renderer.render(hostElement, undefined);

        const marker = hostElement.querySelector('.cogno-marker');
        expect(marker).toBeTruthy();
        expect(marker?.textContent).toBe('COGNO');
    });

    it('should render text segments', () => {
        const segments: PromptSegment[] = [
            { text: 'Hello ' },
            { text: 'World' }
        ];
        const renderer = new PromptMarkerRenderer(sessionState, segments);
        renderer.render(hostElement, undefined);

        const spans = hostElement.querySelectorAll('.prompt-segment');
        expect(spans.length).toBe(2);
        expect(spans[0].textContent).toBe('Hello ');
        expect(spans[1].textContent).toBe('World');
    });

    it('should render field segments from command', () => {
        const command = new Command({
            id: 'cmd-1',
            user: 'tester',
            machine: 'localhost',
            directory: '~/projects'
        });
        sessionState.addCommand(command);

        const segments: PromptSegment[] = [
            { field: 'user' },
            { text: '@' },
            { field: 'machine' },
            { text: ':' },
            { field: 'directory' }
        ];
        const renderer = new PromptMarkerRenderer(sessionState, segments);
        renderer.render(hostElement, 'cmd-1');

        const marker = hostElement.querySelector('.cogno-marker');
        expect(marker?.textContent).toBe('tester@localhost:~/projects');
    });

    it('should apply styles correctly', () => {
        const segments: PromptSegment[] = [{
            text: 'Styled',
            foreground: 'red',
            background: '#00ff00',
            bold: true,
            italic: true,
            underline: true,
            size: 14,
            padding_left: 5,
            margin_right: 10,
            radius_left: 4,
            className: 'custom-class',
            title: 'Hover me'
        }];
        const renderer = new PromptMarkerRenderer(sessionState, segments);
        renderer.render(hostElement, undefined);

        const span = hostElement.querySelector('.prompt-segment') as HTMLElement;
        expect(span.style.color).toBe('var(--color-red)');
        expect(span.style.backgroundColor).toBe('#00ff00'); // #00ff00
        expect(span.style.fontWeight).toBe('600');
        expect(span.style.fontStyle).toBe('italic');
        expect(span.style.textDecoration).toBe('underline');
        expect(span.style.fontSize).toBe('14px');
        expect(span.style.paddingLeft).toBe('5px');
        expect(span.style.marginRight).toBe('10px');
        expect(span.style.borderTopLeftRadius).toBe('4px');
        expect(span.classList.contains('custom-class')).toBe(true);
        expect(span.title).toBe('Hover me');
    });

    it('should evaluate "when" conditions correctly', () => {
        const command = new Command({
            id: 'cmd-1',
            returnCode: '0'
        });
        const commandError = new Command({
            id: 'cmd-2',
            returnCode: '1'
        });
        sessionState.addCommand(command);
        sessionState.addCommand(commandError);

        const segments: PromptSegment[] = [
            { text: 'OK', when: 'returnCode == 0' },
            { text: 'FAIL', when: 'returnCode != 0' }
        ];
        const renderer = new PromptMarkerRenderer(sessionState, segments);

        // Test with returnCode 0
        // Note: in PromptMarkerRenderer, returnCode is taken from the NEXT command 
        // if we are looking at a history command. For the last command, it's isInput=true.
        // Wait, let's check createCommandRecord logic:
        // if index+1 exists, returnCode = next.returnCode.
        
        const cmdNext = new Command({ id: 'cmd-next', returnCode: '1' });
        sessionState.addCommand(cmdNext); // cmd-1 is at index 0, cmd-2 at index 1, cmd-next at index 2
        
        // Render cmd-1 (index 0). Next is cmd-2 (index 1) with returnCode 1.
        renderer.render(hostElement, 'cmd-1');
        expect(hostElement.textContent).toBe('FAIL');

        // Render cmd-2 (index 1). Next is cmd-next (index 2) with returnCode 1.
        renderer.render(hostElement, 'cmd-2');
        expect(hostElement.textContent).toBe('FAIL');
        
        // Add a command with returnCode 0 after cmd-2
        sessionState.addCommand(new Command({id: 'cmd-0', returnCode: '0'}));
        // commands: [cmd-1, cmd-2, cmd-next, cmd-0]
        // cmd-next is at index 2. Next is cmd-0 with returnCode 0.
        renderer.render(hostElement, 'cmd-next');
        expect(hostElement.textContent).toBe('OK');
    });

    it('should format values correctly', () => {
        const command = new Command({
            id: 'cmd-1',
            user: 'john'
        });
        sessionState.addCommand(command);

        const segments: PromptSegment[] = [
            { field: 'user', format: 'upper' },
            { text: '|' },
            { field: 'user', format: 'json' }
        ];
        const renderer = new PromptMarkerRenderer(sessionState, segments);
        renderer.render(hostElement, 'cmd-1');

        expect(hostElement.textContent).toBe('JOHN|"john"');
    });

    it('should add "input" class for the last command', () => {
        const command = new Command({ id: 'cmd-1' });
        sessionState.addCommand(command);

        const renderer = new PromptMarkerRenderer(sessionState, [{ text: 'Prompt' }]);
        renderer.render(hostElement, 'cmd-1');

        const marker = hostElement.querySelector('.cogno-marker');
        expect(marker?.classList.contains('input')).toBe(true);
    });

    it('should handle missing fields with fallback', () => {
        const command = new Command({ id: 'cmd-1' });
        sessionState.addCommand(command);

        const segments: PromptSegment[] = [
            { field: 'nonexistent', fallback: 'MISSING' }
        ];
        const renderer = new PromptMarkerRenderer(sessionState, segments);
        renderer.render(hostElement, 'cmd-1');

        expect(hostElement.textContent).toBe('MISSING');
    });

    it('should handle undefined commandId gracefully', () => {
        const segments: PromptSegment[] = [{ field: 'user', fallback: 'anonymous' }];
        const renderer = new PromptMarkerRenderer(sessionState, segments);
        renderer.render(hostElement, undefined);

        expect(hostElement.textContent).toBe('anonymous');
    });

    it('should not render segments with false "when" condition', () => {
        const segments: PromptSegment[] = [
            { text: 'Hidden', when: 'isInput == true' },
            { text: 'Visible', when: 'isInput == false' }
        ];
        const renderer = new PromptMarkerRenderer(sessionState, segments);
        // buildRecord(undefined) returns isInput: false
        renderer.render(hostElement, undefined);

        expect(hostElement.textContent).toBe('Visible');
    });

    it('should handle invalid "when" expressions', () => {
        const segments: PromptSegment[] = [
            { text: 'ShouldNotAppear', when: 'invalid expression' }
        ];
        const renderer = new PromptMarkerRenderer(sessionState, segments);
        renderer.render(hostElement, undefined);

        expect(hostElement.textContent).toBe('');
    });
});
