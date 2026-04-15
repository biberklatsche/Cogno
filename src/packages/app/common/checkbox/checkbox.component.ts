import { Component, input, model } from "@angular/core";

@Component({
  selector: "app-checkbox",
  imports: [],
  template: `
      <div class="checkbox-container" (click)="toggle()">
          @if(label()) {
              <label>{{label()}}</label>    
          }
          <input type="checkbox" [checked]="checked()">
          <span class="checkmark checkbox"></span>
          @if(description()){
            <small>{{description()}}</small>  
          } 
      </div>
  `,
  styles: [
    `
      .checkbox-container {
          position: relative;
          padding-left: 1.6rem;
          /*cursor: pointer;*/
          user-select: none;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;

          &.disabled {
              opacity: 0.5;
              pointer-events: none;
          }

          small {
              display: block;
          }

          /* Hide the browser's default radio button */
          input {
              position: absolute;
              opacity: 0;
              height: 0;
              width: 0;

              /* Show the indicator (dot/circle) when checked */
              &:checked ~ .checkmark:after {
                  display: block;
              }
          }

          /* Create a custom radio button */
          .checkmark {
              position: absolute;
              top: 0;
              left: 0;
              border: 2px solid var(--background-color-20l);
              background-color: var(--background-color-40l);
          }

          .checkbox {
              height: 1rem;
              width: 1rem;
              border-radius: 3px;

              &:after {
                  content: "";
                  position: absolute;
                  display: none;
                  left: 0.3rem;
                  width: 0.3rem;
                  height: 0.6rem;
                  border: solid var(--foreground-color);
                  border-width: 0 3px 3px 0;
                  transform: rotate(45deg);
              }
          }
      }
  `,
  ],
})
export class CheckboxComponent {
  checked = model<boolean>(false);
  label = input<string | undefined>();
  description = input<string | undefined>();

  toggle() {
    this.checked.update((s) => !s);
  }
}
