import {Component, OnDestroy, OnInit} from '@angular/core';
import {
    NotificationService
} from "../+state/notification.service";

@Component({
  selector: 'app-notification-side',
  imports: [],
  templateUrl: './notification-side.component.html',
  styleUrl: './notification-side.component.scss'
})
export class NotificationSideComponent implements OnInit, OnDestroy {

    constructor(private notificationService: NotificationService) {

    }

    ngOnDestroy(): void {
        this.notificationService.dispose();
    }

    ngOnInit(): void {
        this.notificationService.initView();
    }
}
