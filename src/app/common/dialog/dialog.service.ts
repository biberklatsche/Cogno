import {ApplicationRef, ComponentRef, EnvironmentInjector, Injectable, Injector, TemplateRef, Type, createComponent} from '@angular/core';
import {DialogComponent} from './dialog.component';
import {DialogConfig} from './dialog-config';
import {DialogRef} from './dialog-ref';

let NEXT_ID = 1;

@Injectable({ providedIn: 'root' })
export class DialogService {
  constructor(
    private readonly appRef: ApplicationRef,
    private readonly envInjector: EnvironmentInjector,
    private readonly injector: Injector,
  ) {}

  open<TData = unknown, TResult = unknown, TContext = unknown>(content: Type<unknown> | TemplateRef<TContext>, config: DialogConfig<TData, TContext> = {}): DialogRef<TResult> {
    const id = NEXT_ID++;
    const containerRef = this.createContainer<TResult, TData, TContext>(id, content, config);
    return containerRef.instance.dialogRef();
  }

  private createContainer<TResult, TData, TContext>(
    id: number,
    content: Type<unknown> | TemplateRef<TContext>,
    config: DialogConfig<TData, TContext>,
  ): ComponentRef<DialogComponent<TData>> {
    // Defaults
    const merged: DialogConfig<TData, TContext> = {
      hasBackdrop: true,
      movable: false,
      resizable: false,
      ...config,
    };

    const hostRef = createComponent(DialogComponent<TData>, {
      environmentInjector: this.envInjector,
      elementInjector: this.injector,
    });
    const hostEl = hostRef.location.nativeElement as HTMLElement;

    // Create a DialogRef and connect destroy
    const destroy = () => {
      this.appRef.detachView(hostRef.hostView);
      hostRef.destroy();
      hostEl.remove();
    };
    const dialogRef = new DialogRef<TResult>(id, destroy);

    // Set inputs
    hostRef.setInput('config', merged);
    hostRef.setInput('dialogRef', dialogRef);
    hostRef.setInput('component', content);

    // Attach to application and DOM
    this.appRef.attachView(hostRef.hostView);
    document.body.appendChild(hostEl);

    return hostRef;
  }
}
