import {CommonModule} from '@angular/common';
import {
    Component,
    DestroyRef,
    EffectRef,
    ElementRef,
    EventEmitter,
    HostListener,
    Injector,
    Input,
    OnInit,
    Output,
    Signal,
    WritableSignal,
    computed,
    createComponent,
    effect,
    inject,
    input,
    runInInjectionContext,
    signal,
    viewChild,
    Type
} from '@angular/core';
import {NgComponentOutlet, NgTemplateOutlet} from '@angular/common';
import {DialogConfig} from './dialog-config';
import {DialogRef} from './dialog-ref';
import {DIALOG_DATA} from './dialog.tokens';

@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet],
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
        background: var(--background-color);
        color: var(--foreground-color);
        border: 1px solid var(--background-color-20l);
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
        padding: 8px 12px;
        border-bottom: 1px solid var(--background-color-20l);
      }

      .content {
        padding: 12px;
        overflow: auto;
      }

      .close-btn {
        background: transparent;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
      }
      .close-btn:hover, .close-btn:focus-visible {
        background: var(--background-color-20l);
        outline: none;
      }
    `
  ],
  template: `
    @if (config().hasBackdrop) {
      <div class="backdrop" [ngClass]="config().backdropClass" (click)="onBackdropClick()"></div>
    }
    <div
      class="panel base-overlay"
      [ngStyle]="{
        width: config().width ?? 'auto',
        height: config().height ?? 'auto',
        maxWidth: config().maxWidth ?? '90vw',
        maxHeight: config().maxHeight ?? '90vh'
      }"
      [ngClass]="config().panelClass">
      
        <div class="header">
          <div class="title">{{ config().title }}</div>
            @if (config().showCloseButton) {
          <button class="close-btn" (click)="close()" aria-label="Close">✕</button>
            }
        </div>
     
      <div class="content" tabindex="0" #contentEl>
          <ng-container *ngComponentOutlet="component(); injector: contentInjector"></ng-container>
      </div>
    </div>
  `
})
export class DialogComponent<TData = unknown> implements OnInit {
  config = input.required<DialogConfig<TData>>();
  dialogRef = input.required<DialogRef<any>>();

  component = input.required<Type<any>>();

  contentInjector?: Injector;

  private readonly injector = inject(Injector);

  ngOnInit(): void {
    // Create child injector to provide dialog data and ref
    this.contentInjector = Injector.create({
      providers: [
        { provide: DIALOG_DATA, useValue: this.config().data },
        { provide: DialogRef, useValue: this.dialogRef() }
      ],
      parent: this.injector
    });
  }

  onBackdropClick() {
    this.close();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEsc(e: KeyboardEvent) {
    e.stopPropagation();
    this.close();
  }

  close() {
    this.dialogRef().close();
  }
}
