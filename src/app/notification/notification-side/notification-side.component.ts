import {Component, Signal} from '@angular/core';

import {
    Notification, NotificationId,
    NotificationService
} from '../+state/notification.service';
import {IconComponent} from '../../icons/icon/icon.component';
import {Icon} from '../../icons/+model/icon';
import {TimeAgoPipe} from '../../common/time-ago/time-ago.pipe';

@Component({
  selector: 'app-notification-side',
    imports: [
    IconComponent,
    TimeAgoPipe
],
  templateUrl: './notification-side.component.html',
  styleUrl: './notification-side.component.scss'})
export class NotificationSideComponent {

    notifications: Signal<Notification[]>;

    constructor(private notificationService: NotificationService) {
        this.notifications = notificationService.notifications;
    }

    getIcon(type?: Notification['type']): Icon {
        switch(type) {
            case 'success':
                return 'mdiCheckCircle';
            case 'warning':
                return 'mdiAlert';
            case 'error':
                return 'mdiAlert';
            case 'info':
            default:
                return 'mdiInformation';
        }
    }

    remove(notificationId: NotificationId) {
        this.notificationService.remove(notificationId);
    }
}
