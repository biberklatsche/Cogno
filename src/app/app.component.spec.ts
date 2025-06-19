import {AppComponent} from "./app.component";
import {readTextFile} from "../__mocks__/plugin-fs";
import {appConfigDir} from "../__mocks__/api-path";
import {SettingsService} from './settings/settings.service';
import {platform} from '../__mocks__/plugin-os';

describe('AppComponent', () => {
    let component: AppComponent;
    let settingsService: SettingsService;

    beforeEach(() => {
        readTextFile.mockReset();
        appConfigDir.mockReset();
        platform.mockReset();
        settingsService = new SettingsService();

    })

    test('should load settings', (done) => {
        readTextFile.mockResolvedValueOnce('mocked content');
        appConfigDir.mockResolvedValueOnce('mocked content');
        platform.mockResolvedValueOnce('linux');
        settingsService.settings.subscribe(settings => {
            expect(settings).toBeTruthy();
            done();
        })
        component = new AppComponent(settingsService);
    })
})
