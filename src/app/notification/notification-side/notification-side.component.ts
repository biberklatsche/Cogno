import {Component, OnDestroy, OnInit} from '@angular/core';
import {
    NotificationService
} from "../+state/notification.service";
import {SideMenuItemComponent} from "../../menu/side-menu/+state/side-menu.service";

@Component({
  selector: 'app-notification-side',
  imports: [],
  templateUrl: './notification-side.component.html',
  styleUrl: './notification-side.component.scss'
})
export class NotificationSideComponent implements OnInit, OnDestroy, SideMenuItemComponent {

    constructor(private notificationService: NotificationService) {

    }

    onSideMenuKey(event: KeyboardEvent): void {
    }

    ngOnDestroy(): void {
        this.notificationService.dispose();
    }

    ngOnInit(): void {
        this.notificationService.initView();
    }
}
