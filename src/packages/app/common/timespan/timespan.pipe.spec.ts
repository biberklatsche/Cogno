import { TimespanPipe } from "./timespan.pipe";

describe("TimespanPipe", () => {
  it("create an instance", () => {
    const pipe = new TimespanPipe();
    expect(pipe).toBeTruthy();
  });

  it("should render 1ms", () => {
    const pipe = new TimespanPipe();
    expect(pipe.transform(1)).toEqual("1ms");
  });

  it("should render 1s", () => {
    const pipe = new TimespanPipe();
    expect(pipe.transform(1000)).toEqual("1s");
  });

  it("should render 1m", () => {
    const pipe = new TimespanPipe();
    expect(pipe.transform(60 * 1000)).toEqual("1m");
  });

  it("should render 1h", () => {
    const pipe = new TimespanPipe();
    expect(pipe.transform(60 * 60 * 1000)).toEqual("1h");
  });

  it("should render 1h1ms", () => {
    const pipe = new TimespanPipe();
    expect(pipe.transform(60 * 60 * 1000 + 1)).toEqual("1h 1ms");
  });

  it("should render not more than 2 parts", () => {
    const pipe = new TimespanPipe();
    expect(pipe.transform(60 * 60 * 1000 + 59 * 60 * 1000 + 1)).toEqual("~ 1h 59m");
  });
});
