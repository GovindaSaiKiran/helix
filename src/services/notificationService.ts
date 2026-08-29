import { AppNotification } from '../types';

class NotificationService {
  private notifications: AppNotification[] = [];

  async getNotifications(): Promise<AppNotification[]> {
    return Promise.resolve([...this.notifications]);
  }

  async markAsRead(id: string): Promise<void> {
    const item = this.notifications.find(n => n.id === id);
    if (item) {
      item.read = true;
    }
    return Promise.resolve();
  }

  async markAllAsRead(): Promise<void> {
    this.notifications.forEach(n => {
      n.read = true;
    });
    return Promise.resolve();
  }

  async sendInAppReminder(title: string, message: string, actionUrl?: string): Promise<AppNotification> {
    const newNotif: AppNotification = {
      id: `notif_${Date.now()}`,
      title,
      message,
      channel: 'in_app',
      type: 'reminder',
      read: false,
      createdAt: 'Just now',
      actionUrl,
    };
    this.notifications.unshift(newNotif);
    return Promise.resolve(newNotif);
  }
}

export const notificationService = new NotificationService();
