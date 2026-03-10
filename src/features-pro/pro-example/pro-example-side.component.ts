import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "app-pro-example-side",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pro-example-side">
      <h3>Pro Example</h3>
      <p>This is a minimal pro feature scaffold.</p>
    </section>
  `,
  styles: [
    `
      .pro-example-side {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      h3 {
        margin: 0;
        font-size: 1rem;
      }

      p {
        margin: 0;
        opacity: 0.8;
      }
    `,
  ],
})
export class ProExampleSideComponent {}
