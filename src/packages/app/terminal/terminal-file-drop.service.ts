import { DestroyRef, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AppWindow } from "@cogno/app-tauri/window";
import { TerminalSession } from "./+state/terminal.session";

type NativeDragDropEvent = {
    type: "enter" | "over" | "drop" | "leave";
    position?: { x: number; y: number };
    paths?: string[];
};

@Injectable()
export class TerminalFileDropService {
    private hostElement?: HTMLDivElement;
    private initialized = false;

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly terminalSession: TerminalSession,
    ) {}

    initialize(hostElement: HTMLDivElement): void {
        this.hostElement = hostElement;
        if (this.initialized) {
            return;
        }

        this.initialized = true;
        AppWindow.onDragDrop$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((event) => this.handleNativeDragDropEvent(event));
    }

    private handleNativeDragDropEvent(event: NativeDragDropEvent): void {
        if (event.type === "leave") {
            return;
        }

        if (!event.position || !this.isPositionInsideHost(event.position.x, event.position.y)) {
            return;
        }

        if (event.type === "enter" || event.type === "over") {
            return;
        }

        if (event.type === "drop" && event.paths && event.paths.length > 0) {
            this.insertDroppedPaths(event.paths);
        }
    }

    private insertDroppedPaths(paths: readonly string[]): void {
        this.terminalSession.insertPaths(paths);
        void AppWindow.setFocus().finally(() => {
            this.terminalSession.focus();
        });
    }

    private isPositionInsideHost(physicalX: number, physicalY: number): boolean {
        if (!this.hostElement) {
            return false;
        }

        const rectangle = this.hostElement.getBoundingClientRect();
        const scale = window.devicePixelRatio || 1;
        const clientX = physicalX / scale;
        const clientY = physicalY / scale;

        return clientX >= rectangle.left
            && clientX <= rectangle.right
            && clientY >= rectangle.top
            && clientY <= rectangle.bottom;
    }
}


