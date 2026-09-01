import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  input,
  OnInit,
  Signal,
  ViewChild,
  ViewEncapsulation,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ConfigService } from "@cogno/core/infrastructure/config/config.service";
import { ShellProfile } from "@cogno/core/infrastructure/config/models/shell-config";
import { Environment } from "@cogno/core/infrastructure/environment/environment";
import { AutocompleteSuggestorSource } from "@cogno/core/session/autocomplete/autocomplete-suggestor.source";
import { TerminalAutocompleteComponent } from "@cogno/core/session/autocomplete/terminal-autocomplete.component";
import { TerminalAutocompleteService } from "@cogno/core/session/autocomplete/terminal-autocomplete.service";
import { SessionCommandLog } from "@cogno/core/session/command-log/session-command-log";
import { TerminalComposerComponent } from "@cogno/core/session/composer/terminal-composer.component";
import { TerminalComposerService } from "@cogno/core/session/composer/terminal-composer.service";
import { TerminalHistoryComponent } from "@cogno/core/session/history/terminal-history.component";
import { TerminalHistoryService } from "@cogno/core/session/history/terminal-history.service";
import { SessionHost } from "@cogno/core/session/host/session-host";
import { TerminalCommandHistoryStore } from "@cogno/core/session/model/command-history.store";
import { CommandRecorder } from "@cogno/core/session/recorder/command-recorder";
import { Opener, OsPlatform, PtyTransport } from "@cogno/platform";
import { ClipboardAccess } from "@cogno/platform/clipboard";
import { TerminalId } from "@cogno/shared/ports";
import { ContextMenuItem, ContextMenuOverlayService, IconComponent } from "@cogno/shared/ui";
import { map } from "rxjs";
import { AppBus } from "../app-bus/app-bus";
import { TerminalAutocompleteFeatureSuggestorService } from "../app-host/terminal-autocomplete-feature-suggestor.service";
import { KeybindExecutor } from "./+state/keybind/keybind.executor";
import { SessionFactBridge } from "./+state/session-fact-bridge";
import { SessionMenus } from "./+state/session-menus";
import { TerminalHeaderComponent } from "./header/terminal-header.component";
import { TerminalFileDropService } from "./terminal-file-drop.service";

/** The host is a plain class; Angular only wires its sources. */
export function createSessionHost(
  os: OsPlatform,
  environment: Environment,
  clipboard: ClipboardAccess,
  configService: ConfigService,
  opener: Opener,
  contextMenuOverlay: ContextMenuOverlayService,
  ptyTransport: PtyTransport,
  historyStore: TerminalCommandHistoryStore,
  recorder: CommandRecorder,
): SessionHost {
  return new SessionHost(
    os,
    environment,
    clipboard,
    configService,
    opener,
    contextMenuOverlay,
    ptyTransport,
    historyStore,
    recorder,
  );
}

@Component({
  selector: "app-terminal",
  templateUrl: "./terminal.component.html",
  styleUrls: ["./terminal.component.scss"],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TerminalHeaderComponent,
    TerminalAutocompleteComponent,
    TerminalComposerComponent,
    TerminalHistoryComponent,
    IconComponent,
  ],
  providers: [
    TerminalCommandHistoryStore,
    SessionCommandLog,
    CommandRecorder,
    {
      provide: SessionHost,
      useFactory: createSessionHost,
      deps: [
        OsPlatform,
        Environment,
        ClipboardAccess,
        ConfigService,
        Opener,
        ContextMenuOverlayService,
        PtyTransport,
        TerminalCommandHistoryStore,
        CommandRecorder,
      ],
    },
    {
      provide: AutocompleteSuggestorSource,
      useExisting: TerminalAutocompleteFeatureSuggestorService,
    },
    SessionFactBridge,
    SessionMenus,
    TerminalAutocompleteService,
    TerminalComposerService,
    TerminalHistoryService,
    TerminalFileDropService,
  ],
  encapsulation: ViewEncapsulation.None,
})
export class TerminalComponent implements OnInit, AfterViewInit {
  @ViewChild("terminalContainer", { static: true }) terminalContainer!: ElementRef<HTMLDivElement>;

  terminalId = input.required<TerminalId>();
  shellProfile = input.required<ShellProfile>();

  isFocused: Signal<boolean | undefined>;
  isInFullScreenMode: Signal<boolean | undefined>;
  showScrollToBottomButton: Signal<boolean>;
  isWebglContextLost: Signal<boolean>;

  constructor(
    private destroyRef: DestroyRef,
    private menu: ContextMenuOverlayService,
    private bus: AppBus,
    private host: SessionHost,
    private bridge: SessionFactBridge,
    private menus: SessionMenus,
    private terminalAutocomplete: TerminalAutocompleteService,
    private terminalComposer: TerminalComposerService,
    private terminalHistory: TerminalHistoryService,
    private terminalFileDropService: TerminalFileDropService,
  ) {
    this.isFocused = toSignal(this.host.machine.isFocused$);
    this.isInFullScreenMode = toSignal(this.host.machine.isInFullScreenMode$);
    this.showScrollToBottomButton = toSignal(
      this.host.machine.scrolledLinesFromBottom$.pipe(
        map((scrolledLinesFromBottom) => scrolledLinesFromBottom > 20),
      ),
      { initialValue: false },
    );
    this.isWebglContextLost = toSignal(this.host.isWebglContextLost$, { initialValue: false });
  }

  ngOnInit(): void {
    this.host.initialize(this.terminalId(), this.shellProfile());
    this.bridge.start(this.terminalId(), this.shellProfile());
    const keybindExecutor = new KeybindExecutor(this.bus, this.host);
    this.destroyRef.onDestroy(() => {
      keybindExecutor.dispose();
      this.menus.dispose();
      this.bridge.dispose();
      this.host.dispose();
    });
  }

  ngAfterViewInit(): void {
    this.terminalAutocomplete.setHostElement(this.terminalContainer.nativeElement);
    this.terminalComposer.setHostElement(this.terminalContainer.nativeElement);
    this.terminalHistory.setHostElement(this.terminalContainer.nativeElement);
    this.host.initializeTerminal(this.terminalContainer.nativeElement);
    this.terminalFileDropService.initialize(this.terminalContainer.nativeElement);
  }

  onContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.host.focus();
    const items: ContextMenuItem[] = this.menus.buildContextMenu();
    this.menu.openAtPoint(event, { items });
  }

  focus(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.host.focus();
  }

  scrollToBottom(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.host.scrollToBottom();
  }
}
