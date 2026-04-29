import { AppBus } from "@cogno/app/app-bus/app-bus";
import { timespan } from "@cogno/app/common/timespan/timespan";
import { PromptSegment } from "@cogno/app/config/+models/prompt-config";
import { ContextMenuOverlayService } from "@cogno/app/menu/context-menu-overlay/context-menu-overlay.service";
import { ContextMenuItem } from "@cogno/app/menu/context-menu-overlay/context-menu-overlay.types";
import { mdiDotsVertical } from "@mdi/js";
import { Command, TerminalStateManager } from "../../state";
import { buildCommandMenuItems, CommandMenuBlockRange } from "./command-menu-items";

type PromptRecord = {
  label?: string;
  directory?: string;
  user?: string;
  machine?: string;
  returnCode?: number;
  duration?: number;
  isInput: boolean;
};

type ComparisonOperator = "==" | "!=";
type PrimitiveValue = string | number | boolean;
type PromptMarkerRenderContext = {
  commandIndex?: number;
  markerText?: string;
  getCommandOutput?: () => string;
  getBlockRange?: () => CommandMenuBlockRange;
  scrollToCommandTop?: () => void;
  scrollToCommandBottom?: () => void;
};
type PromptMarkerContextMenuOverlayPort = Pick<ContextMenuOverlayService, "openContextForElement">;

export class PromptMarkerRenderer {
  private static readonly DEFAULT_LABEL = "COGNO";
  private static readonly BOLD_WEIGHT = "600";

  public constructor(
    private readonly stateManager: TerminalStateManager,
    private readonly segments: PromptSegment[],
    private readonly contextMenuOverlayService?: PromptMarkerContextMenuOverlayPort,
    private readonly appBus?: AppBus,
  ) {}

  public render(
    hostElement: HTMLElement,
    commandIndexOrContext?: number | PromptMarkerRenderContext,
  ): void {
    hostElement.replaceChildren();
    hostElement.style.width = "100%";
    const renderContext = this.resolveRenderContext(commandIndexOrContext);
    const commands = this.stateManager.commands;
    const command = commands[renderContext.commandIndex ?? 0];

    if (!command) {
      return;
    }

    const markerElement = this.createMarkerElement(command);
    const markerCoverElement = this.createMarkerCoverElement(renderContext.markerText, command);
    const markerContentElement = this.createMarkerContentElement();
    const record = this.buildRecord(command);

    if (this.segments.length === 0) {
      this.renderFallback(markerContentElement);
    } else {
      this.renderSegments(markerContentElement, record);
    }

    if (record.isInput) {
      markerElement.classList.add("input");
    }

    markerElement.appendChild(markerCoverElement);
    markerElement.appendChild(markerContentElement);
    const markerMenuButton = this.createMenuButton(
      command,
      renderContext.getCommandOutput,
      renderContext.getBlockRange,
      renderContext.scrollToCommandTop,
      renderContext.scrollToCommandBottom,
    );
    if (markerMenuButton) {
      markerElement.appendChild(markerMenuButton);
    }

    hostElement.appendChild(markerElement);
  }

  private createMarkerElement(command: Command): HTMLDivElement {
    const element = document.createElement("div");
    element.classList.add("cogno-marker");
    element.style.minWidth = `${3 + (command.id?.length ?? 2)}rem`;
    element.style.display = "flex";
    element.style.alignItems = "center";
    element.style.justifyContent = "flex-start";
    element.style.gap = "0.5rem";
    element.style.width = "100%";
    element.style.minWidth = "0";
    element.style.boxSizing = "border-box";
    return element;
  }

  private createMarkerCoverElement(
    markerText: string | undefined,
    command: Command,
  ): HTMLDivElement {
    const element = document.createElement("div");
    element.classList.add("cogno-marker__cover");
    element.style.position = "absolute";
    element.style.left = "0";
    element.style.top = "0";
    element.style.height = "100%";
    element.style.width = `${this.resolveMarkerWidth(markerText, command)}ch`;
    element.style.backgroundColor = "var(--background-color)";
    element.style.pointerEvents = "none";
    element.style.zIndex = "1";
    return element;
  }

  private createMarkerContentElement(): HTMLDivElement {
    const element = document.createElement("div");
    element.classList.add("cogno-marker__content");
    element.style.position = "relative";
    element.style.zIndex = "2";
    element.style.display = "inline-flex";
    element.style.alignItems = "center";
    element.style.flexWrap = "nowrap";
    element.style.whiteSpace = "nowrap";
    element.style.minWidth = "0";
    element.style.flex = "0 1 auto";
    element.style.overflow = "hidden";
    return element;
  }

  private resolveMarkerWidth(markerText: string | undefined, command: Command): number {
    const match = markerText?.match(/^\^\^#\d+/);
    if (match) {
      return match[0].length;
    }

    return 3 + (command.id?.length ?? 2);
  }

  private renderFallback(markerElement: HTMLElement): void {
    markerElement.textContent = PromptMarkerRenderer.DEFAULT_LABEL;
  }

  private renderSegments(markerElement: HTMLElement, record: PromptRecord): void {
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
    const span = document.createElement("span");
    span.classList.add("prompt-segment");
    span.textContent = text;
    span.style.zIndex = (99 - index).toString(10);
    this.applyStyles(span, segment);
    markerElement.appendChild(span);
  }

  private createMenuButton(
    command: Command,
    getCommandOutput?: () => string,
    getBlockRange?: () => CommandMenuBlockRange,
    scrollToCommandTop?: () => void,
    scrollToCommandBottom?: () => void,
  ): HTMLButtonElement | undefined {
    if (!this.contextMenuOverlayService || !command.command?.trim()) {
      return undefined;
    }

    const buttonElement = document.createElement("button");
    buttonElement.type = "button";
    buttonElement.classList.add("button", "icon-button", "prompt-marker-menu-button");

    buttonElement.setAttribute("aria-label", "Open command menu");
    buttonElement.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style="width: 1rem; height: 1rem; display: block;">
                <path d="${mdiDotsVertical}" fill="currentColor"></path>
            </svg>
        `;
    buttonElement.addEventListener("click", (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const items = this.buildMenuItems(
        command,
        getCommandOutput,
        getBlockRange,
        scrollToCommandTop,
        scrollToCommandBottom,
      );
      this.contextMenuOverlayService?.openContextForElement(buttonElement, { items });
    });

    return buttonElement;
  }

  private buildRecord(command: Command): PromptRecord {
    return this.createCommandRecord(command);
  }

  private createCommandRecord(command: Command): PromptRecord {
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

  private buildMenuItems(
    command: Command,
    getCommandOutput?: () => string,
    getBlockRange?: () => CommandMenuBlockRange,
    scrollToCommandTop?: () => void,
    scrollToCommandBottom?: () => void,
  ): ContextMenuItem[] {
    return buildCommandMenuItems({
      commandText: command.command,
      getCommandOutput,
      getBlockRange,
      scrollToCommandTop,
      scrollToCommandBottom,
      appBus: this.appBus,
      terminalId: this.stateManager.terminalId,
    });
  }

  private resolveRenderContext(
    commandIndexOrContext?: number | PromptMarkerRenderContext,
  ): PromptMarkerRenderContext {
    if (typeof commandIndexOrContext === "number" || commandIndexOrContext === undefined) {
      return {
        commandIndex: commandIndexOrContext,
        markerText: undefined,
        getCommandOutput: undefined,
        getBlockRange: undefined,
        scrollToCommandTop: undefined,
        scrollToCommandBottom: undefined,
      };
    }

    return commandIndexOrContext;
  }

  private resolveSegmentText(segment: PromptSegment, record: PromptRecord): string {
    if ("text" in segment) {
      return segment.text.length > 0 ? segment.text : " ";
    }

    const value = record[segment.field as keyof PromptRecord];
    if (value === undefined || value === null) {
      return segment.fallback ?? "";
    }
    return this.formatValue(value, segment.format);
  }

  private formatValue(value: unknown, format?: string): string {
    switch (format) {
      case "upper":
        return String(value).toUpperCase();
      case "lower":
        return String(value).toLowerCase();
      case "json":
        return JSON.stringify(value);
      case "number":
        return String(Number(value));
      case "timespan":
        return timespan(Number(value));
      default:
        return String(value);
    }
  }

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

    if (trimmed === "true") return true;
    if (trimmed === "false") return false;

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
    if (left === undefined || left === null) return false;
    if (operator === "==") {
      return left === right;
    }
    return left !== right;
  }

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
      element.style.fontStyle = "italic";
    }
    if (segment.underline) {
      element.style.textDecoration = "underline";
    }
    if (segment.size) {
      element.style.fontSize = `${segment.size}px`;
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
    if (color.startsWith("#")) {
      return color;
    }
    return `var(--color-${color})`;
  }
}
