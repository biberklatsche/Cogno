import {Component, OnDestroy, OnInit, Signal} from '@angular/core';
import {
    Notification,
    NotificationId,
    NotificationService
} from '../+state/notification.service';

@Component({
  selector: 'app-notification-side',
  imports: [],
  templateUrl: './notification-side.component.html',
  styleUrl: './notification-side.component.scss'})
export class NotificationSideComponent implements OnInit, OnDestroy {

    notifications: Signal<Notification[]>;

    constructor(private notificationService: NotificationService) {
        this.notifications = notificationService.notifications;
    }

    ngOnDestroy(): void {
        this.notificationService.dispose();
    }

    ngOnInit(): void {
        this.notificationService.initView();
    }
}
