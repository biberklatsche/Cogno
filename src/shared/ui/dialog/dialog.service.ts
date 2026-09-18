import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  EnvironmentInjector,
  Injectable,
  Injector,
  Type,
} from "@angular/core";
import { DialogComponent } from "./dialog.component";
import { DialogConfig } from "./dialog-config";
import { DialogRef } from "./dialog-ref";

let NEXT_ID = 1;

@Injectable({ providedIn: "root" })
export class DialogService {
  constructor(
    private readonly appRef: ApplicationRef,
    private readonly envInjector: EnvironmentInjector,
    private readonly injector: Injector,
  ) {}

  open<TData = unknown, TResult = unknown>(
    content: Type<unknown>,
    config: DialogConfig<TData> = {},
  ): DialogRef<TResult> {
    const id = NEXT_ID++;
    const containerRef = this.createContainer<TResult, TData>(id, content, config);
    return containerRef.instance.dialogRef();
  }

  private createContainer<TResult, TData>(
    id: number,
    content: Type<unknown>,
    config: DialogConfig<TData>,
  ): ComponentRef<DialogComponent<TData, TResult>> {
    // Defaults
    const merged: DialogConfig<TData> = {
      hasBackdrop: true,
      closeOnBackdropClick: true,
      closeOnEscape: true,
      ...config,
    };

    const hostRef = createComponent(DialogComponent<TData, TResult>, {
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
    hostRef.setInput("config", merged);
    hostRef.setInput("dialogRef", dialogRef);
    hostRef.setInput("component", content);

    // Attach to application and DOM
    this.appRef.attachView(hostRef.hostView);
    document.body.appendChild(hostEl);

    return hostRef;
  }
}
