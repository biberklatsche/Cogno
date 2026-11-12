import { Component, provideZonelessChangeDetection, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BrowserTestingModule, platformBrowserTesting } from "@angular/platform-browser/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TreeComponent, TreeDetailDirective, TreeRowDirective } from "./tree.component";

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

type Node = { name: string; children?: Node[] };

@Component({
  standalone: true,
  imports: [TreeComponent, TreeRowDirective, TreeDetailDirective],
  template: `
    <app-tree [nodes]="nodes()" [childrenOf]="childrenOf" [keyOf]="keyOf" [expandAll]="expandAll()">
      <ng-template appTreeRow let-node let-level="level" let-open="open" let-toggle="toggle">
        <button class="name" [attr.data-level]="level" [attr.data-open]="open" (click)="toggle()">
          {{ node.name }}
        </button>
      </ng-template>
      <ng-template appTreeDetail let-node>
        @if (node.name === "src") {
          <span class="detail">3 files</span>
        }
      </ng-template>
    </app-tree>
  `,
})
class HostComponent {
  readonly nodes = signal<Node[]>([
    { name: "src", children: [{ name: "app", children: [{ name: "main.ts" }] }] },
    { name: "README.md" },
  ]);
  readonly expandAll = signal(false);
  readonly childrenOf = (node: Node) => node.children ?? [];
  readonly keyOf = (node: Node) => node.name;
}

describe("TreeComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;

  const names = () =>
    [...element.querySelectorAll(".name")].map((name) => name.textContent?.trim());
  const rowOf = (name: string) =>
    [...element.querySelectorAll<HTMLElement>(".tree-row")].find(
      (row) => row.querySelector(".name")?.textContent?.trim() === name,
    ) as HTMLElement;
  const arrowOf = (name: string) => rowOf(name).querySelector<HTMLElement>("button.tree-toggle");

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => TestBed.resetTestingModule());

  it("shows every node at first, each line as the caller draws it", () => {
    expect(names()).toEqual(["src", "app", "main.ts", "README.md"]);
    expect(rowOf("main.ts").querySelector(".name")?.getAttribute("data-level")).toBe("2");
    expect(element.querySelector(".detail")?.textContent).toBe("3 files");
  });

  it("gives an arrow only to a node that has something under it", () => {
    expect(arrowOf("src")).not.toBeNull();
    expect(arrowOf("README.md")).toBeNull();
    expect(arrowOf("main.ts")).toBeNull();
  });

  it("folds a branch away with its arrow and opens it again", async () => {
    arrowOf("src")?.click();
    await fixture.whenStable();
    expect(names()).toEqual(["src", "README.md"]);
    expect(rowOf("src").querySelector(".name")?.getAttribute("data-open")).toBe("false");

    arrowOf("src")?.click();
    await fixture.whenStable();
    expect(names()).toEqual(["src", "app", "main.ts", "README.md"]);
  });

  it("lets a line fold its own branch", async () => {
    rowOf("app").querySelector<HTMLElement>(".name")?.click();
    await fixture.whenStable();

    expect(names()).toEqual(["src", "app", "README.md"]);
  });

  it("keeps what is folded when the tree is built from new data", async () => {
    arrowOf("app")?.click();
    await fixture.whenStable();

    fixture.componentInstance.nodes.set([
      { name: "src", children: [{ name: "app", children: [{ name: "other.ts" }] }] },
    ]);
    await fixture.whenStable();

    expect(names()).toEqual(["src", "app"]);
  });

  it("shows everything while asked to, and what was folded is folded again after", async () => {
    arrowOf("src")?.click();
    await fixture.whenStable();

    fixture.componentInstance.expandAll.set(true);
    await fixture.whenStable();
    expect(names()).toEqual(["src", "app", "main.ts", "README.md"]);

    fixture.componentInstance.expandAll.set(false);
    await fixture.whenStable();
    expect(names()).toEqual(["src", "README.md"]);
  });
});
