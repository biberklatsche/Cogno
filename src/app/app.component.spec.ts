import {AppComponent} from "./app.component";
import {Environment} from "./environment/environment";
import {readTextFile} from "../__mocks__/plugin-fs";
import {appConfigDir} from "../__mocks__/api-path";

describe('AppComponent', () => {
    let component: AppComponent;

    beforeEach(() => {
        readTextFile.mockReset();
        appConfigDir.mockReset();
    })

    test('should init environment', (done) => {
        readTextFile.mockResolvedValueOnce('mocked content');
        appConfigDir.mockResolvedValueOnce('mocked content');
        /*Environment.settings.subscribe(s => {
            expect(s).toEqual({environment: "mocked content"});
            done();
        });
        component = new AppComponent();*/

    })
})
