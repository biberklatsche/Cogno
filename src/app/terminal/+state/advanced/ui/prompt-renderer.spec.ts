import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptMarkerRenderer } from './prompt-renderer';
import { TerminalStateManager } from '../../state';
import { PromptSegment } from '../../../../config/+models/prompt-config';
import { AppBus } from '../../../../app-bus/app-bus';

describe('PromptMarkerRenderer', () => {
    let stateManager: TerminalStateManager;
    let busMock: AppBus;
    let hostElement: HTMLElement;

    beforeEach(() => {
        busMock = new AppBus();
        vi.spyOn(busMock, 'publish');
        stateManager = new TerminalStateManager(busMock);
        stateManager.initialize('test-term', 'Bash' as any);
        hostElement = document.createElement('div');
    });

    it('should render default label when no segments are provided', () => {
        const renderer = new PromptMarkerRenderer(stateManager, []);
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
        const renderer = new PromptMarkerRenderer(stateManager, segments);
        renderer.render(hostElement, 0);

        const spans = hostElement.querySelectorAll('.prompt-segment');
        expect(spans.length).toBe(2);
        expect(spans[0].textContent).toBe('Hello ');
        expect(spans[1].textContent).toBe('World');
    });

    it('should render field segments from command', () => {
        stateManager.updateCommandList({
            id: 'cmd-1',
            user: 'tester',
            machine: 'localhost',
            directory: '~/projects'
        });

        const segments: PromptSegment[] = [
            { field: 'user' },
            { text: '@' },
            { field: 'machine' },
            { text: ':' },
            { field: 'directory' }
        ];
        const renderer = new PromptMarkerRenderer(stateManager, segments);
        renderer.render(hostElement, 0);

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
        const renderer = new PromptMarkerRenderer(stateManager, segments);
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
        // Create first command
        stateManager.updateCommandList({
            id: 'cmd-1',
            user: 'tester'
        });
        // Add second command, which updates first command with data (returnCode=0)
        stateManager.updateCommandList({
            id: 'cmd-2',
            returnCode: '0'
        });
        
        const segments: PromptSegment[] = [
            { text: 'OK', when: 'returnCode == 0' },
            { text: 'FAIL', when: 'returnCode != 0' }
        ];
        const renderer = new PromptMarkerRenderer(stateManager, segments);

        // Render cmd-1 (index 0). 
        // In createCommandRecord for index 0:
        // isLastCommand = commands[0].command === undefined.
        // It IS undefined, so it returns isInput: true and ONLY directory, user, machine.
        // Thus returnCode is missing!
        
        // We need to make it NOT the last command by giving it a command text
        stateManager.commands[0].set('command', 'ls');

        renderer.render(hostElement, 0);
        expect(hostElement.textContent).toBe('OK');
    });

    it('should format values correctly', () => {
        stateManager.updateCommandList({
            id: 'cmd-1',
            user: 'john'
        });

        const segments: PromptSegment[] = [
            { field: 'user', format: 'upper' },
            { text: '|' },
            { field: 'user', format: 'json' }
        ];
        const renderer = new PromptMarkerRenderer(stateManager, segments);
        renderer.render(hostElement, 0);

        expect(hostElement.textContent).toBe('JOHN|"john"');
    });

    it('should add "input" class for the last command', () => {
        stateManager.updateCommandList({ id: 'cmd-1' });

        const renderer = new PromptMarkerRenderer(stateManager, [{ text: 'Prompt' }]);
        renderer.render(hostElement, 0);

        const marker = hostElement.querySelector('.cogno-marker');
        expect(marker?.classList.contains('input')).toBe(true);
    });

    it('should handle missing fields with fallback', () => {
        stateManager.updateCommandList({ id: 'cmd-1' });

        const segments: PromptSegment[] = [
            { field: 'nonexistent', fallback: 'MISSING' }
        ];
        const renderer = new PromptMarkerRenderer(stateManager, segments);
        renderer.render(hostElement, 0);

        expect(hostElement.textContent).toBe('MISSING');
    });

    it('should handle undefined commandId gracefully', () => {
        const segments: PromptSegment[] = [{ field: 'user', fallback: 'anonymous' }];
        const renderer = new PromptMarkerRenderer(stateManager, segments);
        renderer.render(hostElement, undefined);

        expect(hostElement.textContent).toBe('anonymous');
    });

    it('should not render segments with false "when" condition', () => {
        const segments: PromptSegment[] = [
            { text: 'Hidden', when: 'isInput == true' },
            { text: 'Visible', when: 'isInput == false' }
        ];
        const renderer = new PromptMarkerRenderer(stateManager, segments);
        // buildRecord(undefined) returns isInput: false
        renderer.render(hostElement, undefined);

        expect(hostElement.textContent).toBe('Visible');
    });

    it('should handle invalid "when" expressions', () => {
        const segments: PromptSegment[] = [
            { text: 'ShouldNotAppear', when: 'invalid expression' }
        ];
        const renderer = new PromptMarkerRenderer(stateManager, segments);
        renderer.render(hostElement, undefined);

        expect(hostElement.textContent).toBe('');
    });
});
