import {CognoEvent} from '../../common/event-bus/event-bus';

export const SettingsInitialLoadedEventType =  'SettingsInitialLoaded'

export class SettingsInitialLoadedEvent implements CognoEvent {
    type = SettingsInitialLoadedEventType;
}
