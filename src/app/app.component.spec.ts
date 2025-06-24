import {AppComponent} from "./app.component";
import {exists, readTextFile} from "../__mocks__/plugin-fs";
import {SettingsService} from './settings/+state/settings.service';
import {DEFAULT_SETTINGS} from "./settings/models/default-settings";

describe('AppComponent', () => {
    let component: AppComponent;
    let settingsService: SettingsService;

    beforeEach(() => {
        readTextFile.mockReset();
        exists.mockReset();
        settingsService = new SettingsService();

    })

    test('app should load settings on init', (done) => {
        readTextFile.mockResolvedValue(JSON.stringify(DEFAULT_SETTINGS));
        exists.mockResolvedValue(true)
        settingsService.settings$.subscribe(settings => {
            expect(settings).toBeTruthy();
            done();
        })
        component = new AppComponent(settingsService);
    })
})
