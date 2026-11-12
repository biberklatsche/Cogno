// Looks at and drives the window of a running dev Cogno, over the DevTools
// protocol of its webview: screenshots, clicks, typing and the console. For
// checking by hand, or by an agent, what only shows in the window.
//
// Windows only: WebView2 is Chromium and offers the protocol; the webviews of
// macOS and Linux do not. Start the app with the port open (it listens on
// localhost only):
//
//   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222 pnpm dev
//
//   node scripts/drive-webview.mjs shot <file.png>
//   node scripts/drive-webview.mjs eval "<javascript>"
//   node scripts/drive-webview.mjs click <css> [text]      real mouse click on the first match
//   node scripts/drive-webview.mjs clickat <x> <y>
//   node scripts/drive-webview.mjs hover <css> [text]
//   node scripts/drive-webview.mjs type "<text>"           into the focused element
//   node scripts/drive-webview.mjs key <Enter|Escape|Tab|Ctrl+N>
//   node scripts/drive-webview.mjs pages                   the windows; COGNO_PAGE=<n> picks one
//   node scripts/drive-webview.mjs console [seconds]       what the console said, and says meanwhile
import { writeFileSync } from "node:fs";

const port = process.env.COGNO_DEBUG_PORT ?? "9222";
const [command, ...args] = process.argv.slice(2);

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
// One page per window, in the order the debugger lists them; COGNO_PAGE picks one.
const pages = targets.filter((t) => t.type === "page" && !t.url.startsWith("devtools://"));
const page = pages[Number(process.env.COGNO_PAGE ?? 0)];
if (!page) {
  console.error("No page found:", targets.map((t) => `${t.type} ${t.url}`).join(", "));
  process.exit(1);
}

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
let nextId = 0;
const pending = new Map();
const listeners = [];
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.id !== undefined) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  } else {
    for (const listener of listeners) listener(message);
  }
};
function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const { result, exceptionDetails } = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  }
  return result.value;
}
/** The middle of the first element matching `css` (and containing `text`). */
async function locate(css, text) {
  const point = await evaluate(`(() => {
    const wanted = ${JSON.stringify(text ?? "")};
    const element = [...document.querySelectorAll(${JSON.stringify(css)})]
      .find((each) => !wanted || (each.textContent ?? "").includes(wanted));
    if (!element) return null;
    element.scrollIntoView({ block: "nearest" });
    const box = element.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  })()`);
  if (!point) throw new Error(`Nothing matches ${css}${text ? ` with "${text}"` : ""}`);
  return point;
}
async function mouse(type, point, extra = {}) {
  await send("Input.dispatchMouseEvent", { type, x: point.x, y: point.y, ...extra });
}

switch (command) {
  case "pages": {
    pages.forEach((each, index) => console.log(`${index} ${each.id} ${each.title}`));
    break;
  }
  case "shot": {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(args[0], Buffer.from(data, "base64"));
    console.log(`saved ${args[0]}`);
    break;
  }
  case "eval": {
    console.log(JSON.stringify(await evaluate(args[0]), null, 2));
    break;
  }
  case "hover": {
    await mouse("mouseMoved", await locate(args[0], args[1]));
    break;
  }
  case "click": {
    const point = await locate(args[0], args[1]);
    await mouse("mouseMoved", point);
    await mouse("mousePressed", point, { button: "left", clickCount: 1 });
    await mouse("mouseReleased", point, { button: "left", clickCount: 1 });
    break;
  }
  case "clickat": {
    const point = { x: Number(args[0]), y: Number(args[1]) };
    await mouse("mouseMoved", point);
    await mouse("mousePressed", point, { button: "left", clickCount: 1 });
    await mouse("mouseReleased", point, { button: "left", clickCount: 1 });
    break;
  }
  case "type": {
    await send("Input.insertText", { text: args[0] });
    break;
  }
  case "key": {
    // "Enter", "Escape", "Tab", or a combination such as "Ctrl+N".
    const parts = args[0].split("+");
    const name = parts.pop();
    const modifiers =
      (parts.includes("Alt") ? 1 : 0) |
      (parts.includes("Ctrl") ? 2 : 0) |
      (parts.includes("Meta") ? 4 : 0) |
      (parts.includes("Shift") ? 8 : 0);
    const named = { Enter: 13, Escape: 27, Tab: 9 };
    const key =
      name in named
        ? { key: name, code: name, windowsVirtualKeyCode: named[name] }
        : {
            key: name.toLowerCase(),
            code: `Key${name.toUpperCase()}`,
            windowsVirtualKeyCode: name.toUpperCase().charCodeAt(0),
          };
    await send("Input.dispatchKeyEvent", { type: "keyDown", modifiers, ...key });
    await send("Input.dispatchKeyEvent", { type: "keyUp", modifiers, ...key });
    break;
  }
  case "console": {
    listeners.push(({ method, params }) => {
      if (method === "Runtime.consoleAPICalled") {
        const text = params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ");
        console.log(`[${params.type}] ${text}`);
      } else if (method === "Runtime.exceptionThrown") {
        const details = params.exceptionDetails;
        console.log(`[exception] ${details.exception?.description ?? details.text}`);
      } else if (method === "Log.entryAdded") {
        console.log(`[${params.entry.level}] ${params.entry.text} ${params.entry.url ?? ""}`);
      }
    });
    await send("Runtime.enable");
    await send("Log.enable");
    await new Promise((resolve) => setTimeout(resolve, Number(args[0] ?? 2) * 1000));
    break;
  }
  default:
    console.error("Unknown command; see the head of this file.");
    process.exitCode = 1;
}
socket.close();
