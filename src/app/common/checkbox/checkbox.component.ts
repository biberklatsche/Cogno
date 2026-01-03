import {Component, ViewEncapsulation, signal, input, output} from '@angular/core';


@Component({
  selector: 'app-checkbox',
  imports: [],
  template: `
      <div class="checkbox-container" (click)="toggle()">
          <label>Open Tab in Same Directory</label>
          <input type="checkbox" [checked]="openTabInSameDirectory | async">
          <span class="checkmark checkbox"></span>
          <small>Determines whether a new tab is opened in the same directory as the previously active tab.</small>
      </div>
  `,
  styles: [`
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
  `]
})
export class CheckboxComponent {

    checked = input<boolean>(false);

    toggle() {

    }
}
