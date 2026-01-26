import { SessionState } from "../../session.state";
import { PromptSegment } from "../../../../config/+models/prompt-config";
import {timespan} from "../../../../common/timespan/timespan.pipe";

type PromptRecord = {
    label?: string;
    directory?: string;
    user?: string;
    machine?: string;
    returnCode?: number;
    duration?: number;
    isInput: boolean;
}

type ComparisonOperator = '==' | '!=';
type PrimitiveValue = string | number | boolean;

export class PromptMarkerRenderer {
    private static readonly DEFAULT_LABEL = 'COGNO';
    private static readonly BOLD_WEIGHT = '600';

    public constructor(private readonly sessionState: SessionState, private readonly segments: PromptSegment[]) {}

    public render(
        hostElement: HTMLElement,
        commandIndex: number | undefined,
    ): void {

        hostElement.replaceChildren();

        const markerElement = this.createMarkerElement();
        const record = this.buildRecord(commandIndex);

        if (this.segments.length === 0) {
            this.renderFallback(markerElement);
        } else {
            this.renderSegments(markerElement, record);
        }

        if (record.isInput) {
            markerElement.classList.add('input');
        }

        hostElement.appendChild(markerElement);
    }

    /* ------------------------------------------------------------------ */
    /* DOM creation                                                        */
    /* ------------------------------------------------------------------ */

    private createMarkerElement(): HTMLDivElement {
        const element = document.createElement('div');
        element.classList.add('cogno-marker');
        return element;
    }

    private renderFallback(markerElement: HTMLElement): void {
        markerElement.textContent = PromptMarkerRenderer.DEFAULT_LABEL;
    }

    private renderSegments(
        markerElement: HTMLElement,
        record: PromptRecord,
    ): void {
        for (let index = 0; index < this.segments.length; index++) {
            const segment = this.segments[index];
            if (!this.shouldRenderSegment(segment, record)) {
                continue;
            }

            const text = this.resolveSegmentText(segment, record);
            if (text.length === 0) {
                continue;
            }

            this.appendSegment(markerElement, segment, text, index);
        }
    }

    private shouldRenderSegment(segment: PromptSegment, record: PromptRecord): boolean {
        return !segment.when || this.evaluateWhen(segment.when, record);
    }

    private appendSegment(
        markerElement: HTMLElement,
        segment: PromptSegment,
        text: string,
        index: number,
    ): void {
        const span = document.createElement('span');
        span.classList.add('prompt-segment');
        span.textContent = text;
        span.style.zIndex = (99 - index).toString(10);
        this.applyStyles(span, segment);
        markerElement.appendChild(span);
    }

    /* ------------------------------------------------------------------ */
    /* record building                                                     */
    /* ------------------------------------------------------------------ */
    private buildRecord(commandIndex: number | undefined): PromptRecord {
        if (commandIndex === undefined) {
            return this.createDefaultRecord();
        }
        return this.createCommandRecord(commandIndex);
    }

    private createDefaultRecord(): PromptRecord {
        return {
            label: PromptMarkerRenderer.DEFAULT_LABEL,
            isInput: false,
        };
    }

    private createCommandRecord(index: number): PromptRecord {
        const command = this.sessionState.commands[index];

        if (!command) {
            return this.createDefaultRecord();
        }

        const isLastCommand = command.command === undefined;

        if (isLastCommand) {
            return {
                directory: command.directory,
                user: command.user,
                machine: command.machine,
                isInput: true,
            };
        }

        return {
            directory: command.directory,
            returnCode: command.returnCode,
            duration: command.duration,
            user: command.user,
            machine: command.machine,
            isInput: false,
        };
    }

    /* ------------------------------------------------------------------ */
    /* segment resolution                                                  */
    /* ------------------------------------------------------------------ */

    private resolveSegmentText(
        segment: PromptSegment,
        record: PromptRecord,
    ): string {
        if ('text' in segment) {
            return segment.text.length > 0 ? segment.text : ' ';
        }

        const value = record[segment.field as keyof PromptRecord];
        if (value === undefined || value === null) {
            return segment.fallback ?? '';
        }
        return this.formatValue(value, segment.format);
    }

    private formatValue(value: unknown, format?: string): string {
        switch (format) {
            case 'upper':
                return String(value).toUpperCase();
            case 'lower':
                return String(value).toLowerCase();
            case 'json':
                return JSON.stringify(value);
            case 'number':
                return String(Number(value));
            case 'timespan':
                return timespan(Number(value));
            case 'string':
            default:
                return String(value);
        }
    }

    /* ------------------------------------------------------------------ */
    /* conditional evaluation                                              */
    /* ------------------------------------------------------------------ */

    private evaluateWhen(expression: string, record: PromptRecord): boolean {
        const parsed = this.parseExpression(expression);
        if (!parsed) {
            return false;
        }

        const { field, operator, value } = parsed;
        const recordValue = record[field as keyof PromptRecord];

        return this.compareValues(recordValue, operator, value);
    }

    private parseExpression(expression: string): {
        field: string;
        operator: ComparisonOperator;
        value: PrimitiveValue;
    } | null {
        const match = expression.match(/^(\w+)\s*(==|!=)\s*(.+)$/);
        if (!match) {
            return null;
        }

        const [, field, operator, rawValue] = match;
        return {
            field,
            operator: operator as ComparisonOperator,
            value: this.parseValue(rawValue),
        };
    }

    private parseValue(rawValue: string): PrimitiveValue {
        const trimmed = rawValue.trim();

        if (trimmed === 'true') return true;
        if (trimmed === 'false') return false;

        const numValue = Number(trimmed);
        if (!Number.isNaN(numValue)) {
            return numValue;
        }

        return trimmed;
    }

    private compareValues(
        left: unknown,
        operator: ComparisonOperator,
        right: PrimitiveValue,
    ): boolean {
        if(left === undefined || left === null) return false;
        if (operator === '==') {
            return left === right;
        }
        return left !== right;
    }

    /* ------------------------------------------------------------------ */
    /* styling                                                             */
    /* ------------------------------------------------------------------ */

    private applyStyles(element: HTMLElement, segment: PromptSegment): void {
        this.applyColors(element, segment);
        this.applyTextStyles(element, segment);
        this.applyBorderStyles(element, segment);
        this.applyPaddingStyles(element, segment);
        this.applyMarginStyles(element, segment);
        this.applyMetadata(element, segment);
    }

    private applyColors(element: HTMLElement, segment: PromptSegment): void {
        if (segment.foreground) {
            element.style.color = this.resolveColor(segment.foreground);
        }
        if (segment.background) {
            element.style.backgroundColor = this.resolveColor(segment.background);
        }
    }

    private applyTextStyles(element: HTMLElement, segment: PromptSegment): void {
        if (segment.bold) {
            element.style.fontWeight = PromptMarkerRenderer.BOLD_WEIGHT;
        }
        if (segment.italic) {
            element.style.fontStyle = 'italic';
        }
        if (segment.underline) {
            element.style.textDecoration = 'underline';
        }
        if (segment.size) {
            element.style.fontSize = segment.size + 'px';
        }
    }

    private applyBorderStyles(element: HTMLElement, segment: PromptSegment) {
        if (segment.radius_left) {
            element.style.borderTopLeftRadius = `${segment.radius_left}px`;
            element.style.borderBottomLeftRadius = `${segment.radius_left}px`;
        }
        if (segment.radius_right) {
            element.style.borderTopRightRadius = `${segment.radius_right}px`;
            element.style.borderBottomRightRadius = `${segment.radius_right}px`;
        }
    }

    private applyPaddingStyles(element: HTMLElement, segment: PromptSegment) {
        if (segment.padding_left) {
            element.style.paddingLeft = `${segment.padding_left}px`;
        }
        if (segment.padding_right) {
            element.style.paddingRight = `${segment.padding_right}px`;
        }
    }

    private applyMarginStyles(element: HTMLElement, segment: PromptSegment) {
        if (segment.margin_left) {
            element.style.marginLeft = `${segment.margin_left}px`;
        }
        if (segment.margin_right) {
            element.style.marginRight = `${segment.margin_right}px`;
        }
    }

    private applyMetadata(element: HTMLElement, segment: PromptSegment): void {
        if (segment.className) {
            element.classList.add(segment.className);
        }
        if (segment.title) {
            element.title = segment.title;
        }
    }

    private resolveColor(color: string): string {
        if (color.startsWith('#')) {
            return color;
        }
        return `var(--color-${color})`;
    }
}
