import {AppComponent} from "./app.component";

describe('AppComponent', () => {
    test('should create', () => {
        jest.mock('tauri-pty');
        expect(new AppComponent()).toBeTruthy();
    })
})
