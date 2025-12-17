import {Component, OnDestroy, OnInit, Signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
    Notification, NotificationId,
    NotificationService
} from '../+state/notification.service';
import {IconComponent} from '../../icons/icon/icon.component';
import {Icon} from '../../icons/+model/icon';
import {TimeAgoPipe} from '../../common/time-ago/time-ago.pipe';
import {remove} from '@tauri-apps/plugin-fs';

@Component({
  selector: 'app-notification-side',
    imports: [
        CommonModule,
        IconComponent,
        TimeAgoPipe
    ],
  templateUrl: './notification-side.component.html',
  styleUrl: './notification-side.component.scss'})
export class NotificationSideComponent implements OnInit {

    notifications: Signal<Notification[]>;

    constructor(private notificationService: NotificationService) {
        this.notifications = notificationService.notifications;
    }

    ngOnInit(): void {
        this.notificationService.initView();
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
