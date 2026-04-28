/**
 * 通知管理器
 * 管理所有项目的通知，按项目隔离，内存存储
 */
class NotificationManager {
  constructor() {
    // 按项目ID存储通知，key为项目ID，value为通知数组
    this.notifications = {};
    this.listeners = []; // 通知变化监听器
    this.currentProjectId = null; // 当前项目ID
  }

  /**
   * 设置当前项目
   */
  setCurrentProject(projectId) {
    this.currentProjectId = projectId;
    if (!this.notifications[projectId]) {
      this.notifications[projectId] = [];
    }
    this._notifyListeners();
  }

  /**
   * 获取当前项目的通知
   */
  getNotifications() {
    if (!this.currentProjectId) return [];
    return this.notifications[this.currentProjectId] || [];
  }

  /**
   * 添加通知
   */
  addNotification(type, title, message, data = null) {
    if (!this.currentProjectId) return null;

    const notification = {
      id: Date.now() + Math.random(),
      type,
      title,
      message,
      data,
      timestamp: new Date().toLocaleString('zh-CN'),
      read: false
    };

    if (!this.notifications[this.currentProjectId]) {
      this.notifications[this.currentProjectId] = [];
    }

    this.notifications[this.currentProjectId].unshift(notification);
    this._notifyListeners();
    return notification;
  }

  /**
   * 标记通知为已读
   */
  markAsRead(notificationId) {
    const notifications = this.getNotifications();
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this._notifyListeners();
    }
  }

  /**
   * 标记所有通知为已读
   */
  markAllAsRead() {
    const notifications = this.getNotifications();
    notifications.forEach(n => n.read = true);
    this._notifyListeners();
  }

  /**
   * 删除通知
   */
  deleteNotification(notificationId) {
    if (!this.currentProjectId) return;
    this.notifications[this.currentProjectId] = this.notifications[this.currentProjectId].filter(
      n => n.id !== notificationId
    );
    this._notifyListeners();
  }

  /**
   * 获取未读数量
   */
  getUnreadCount() {
    const notifications = this.getNotifications();
    return notifications.filter(n => !n.read).length;
  }

  /**
   * 清空当前项目的通知
   */
  clearNotifications() {
    if (!this.currentProjectId) return;
    this.notifications[this.currentProjectId] = [];
    this._notifyListeners();
  }

  /**
   * 添加状态变化监听器
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * 移除状态变化监听器
   */
  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知所有监听器
   */
  _notifyListeners() {
    this.listeners.forEach(callback => {
      callback({
        notifications: this.getNotifications(),
        unreadCount: this.getUnreadCount()
      });
    });
  }
}

// 导出单例
export const notificationManager = new NotificationManager();
export default NotificationManager;
