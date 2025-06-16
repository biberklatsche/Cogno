"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionDataType = exports.TabType = exports.WindowState = exports.ShellType = void 0;
var ShellType;
(function (ShellType) {
    ShellType["Bash"] = "Bash";
    ShellType["GitBash"] = "GitBash";
    ShellType["Powershell"] = "Powershell";
    ShellType["ZSH"] = "ZSH";
})(ShellType || (exports.ShellType = ShellType = {}));
var WindowState;
(function (WindowState) {
    WindowState["Maximized"] = "Maximized";
    WindowState["Unmaximized"] = "Unmaximized";
    WindowState["FullScreen"] = "FullScreen";
    WindowState["Minimized"] = "Minimized";
})(WindowState || (exports.WindowState = WindowState = {}));
var TabType;
(function (TabType) {
    TabType[TabType["Terminal"] = 0] = "Terminal";
    TabType[TabType["About"] = 1] = "About";
    TabType[TabType["Settings"] = 2] = "Settings";
    TabType[TabType["ReleaseNotes"] = 3] = "ReleaseNotes";
})(TabType || (exports.TabType = TabType = {}));
var SessionDataType;
(function (SessionDataType) {
    SessionDataType[SessionDataType["New"] = 0] = "New";
    SessionDataType[SessionDataType["Exit"] = 1] = "Exit";
    SessionDataType[SessionDataType["Input"] = 2] = "Input";
    SessionDataType[SessionDataType["Output"] = 3] = "Output";
    SessionDataType[SessionDataType["Resize"] = 4] = "Resize";
    SessionDataType[SessionDataType["Closed"] = 5] = "Closed";
    SessionDataType[SessionDataType["Error"] = 6] = "Error";
    SessionDataType[SessionDataType["Ack"] = 7] = "Ack";
})(SessionDataType || (exports.SessionDataType = SessionDataType = {}));
