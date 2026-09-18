import { NgComponentOutlet } from "@angular/common";
import { Component, HostListener, Injector, input, OnInit, Type } from "@angular/core";
import { IconComponent } from "../icons/icon/icon.component";
import { DIALOG_DATA } from "./dialog.tokens";
import { DialogConfig } from "./dialog-config";
import { DialogRef } from "./dialog-ref";

@Component({
  selector: "app-dialog",
  standalone: true,
  imports: [NgComponentOutlet, IconComponent],
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        display: contents;
      }

      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 10000;
      }

      .panel.base-overlay {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        box-sizing: border-box;
        background: var(--background-color);
        color: var(--foreground-color);
        border: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
        border-radius: 8px;
        box-shadow: 0 10px 24px rgba(0,0,0,0.3);
        max-width: 90vw;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        z-index: 10001;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px;
        border-bottom: 1px solid color-mix(in srgb, var(--theme-lighten-color) calc(var(--background-mix-unit) * var(--mix-step-2)), var(--background-color));
      }

      .content {
        padding: 12px 6px;
        overflow: auto;
      }
    `,
  ],
  template: `
    @if (config().hasBackdrop) {
      <div class="backdrop" (click)="onBackdropClick()"></div>
    }
    <div
      class="panel base-overlay"
      [style.width]="config().width"
      [style.max-width]="config().maxWidth">
        <div class="header">
          <div class="title">{{ config().title }}</div>
            @if (config().showCloseButton) {
          <button class="button icon-button" (click)="close()"><app-icon name="mdiClose"></app-icon></button>
            }
        </div>
     
      <div class="content" tabindex="0">
          <ng-container *ngComponentOutlet="component(); injector: contentInjector"></ng-container>
      </div>
    </div>
  `,
})
export class DialogComponent<TData = unknown, TResult = unknown> implements OnInit {
  config = input.required<DialogConfig<TData>>();
  dialogRef = input.required<DialogRef<TResult>>();

  component = input.required<Type<unknown>>();

  contentInjector?: Injector;

  constructor(private readonly injector: Injector) {}

  ngOnInit(): void {
    // Create child injector to provide dialog data and ref
    this.contentInjector = Injector.create({
      providers: [
        { provide: DIALOG_DATA, useValue: this.config().data },
        { provide: DialogRef, useValue: this.dialogRef() },
      ],
      parent: this.injector,
    });
  }

  onBackdropClick() {
    if (this.config().closeOnBackdropClick === false) {
      return;
    }
    this.close();
  }

  @HostListener("document:keydown.escape", ["$event"])
  onEsc(e: Event) {
    if (this.config().closeOnEscape === false) {
      return;
    }
    e.stopPropagation();
    this.close();
  }

  close() {
    this.dialogRef().close();
  }
}
