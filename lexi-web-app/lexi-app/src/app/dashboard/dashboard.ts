import { Component, AfterViewInit } from '@angular/core';
import { Navbar } from '../navigations/navbar/navbar';
import { SidebarService } from '../services/sidebar.service';
import { Sidebar } from '../navigations/sidebar/sidebar';
import { CommonModule } from '@angular/common';
import { Chat } from '../chat/chat/chat';
import { Modal } from '../modal/modal';
import { AuthService } from '../services/auth.service';
import { ToastContainerComponent } from '../notifications/toast-container.component';
import { ChatHistory } from '../chat-history/chat-history';

@Component({
  selector: 'app-dashboard',
  imports: [Navbar, Sidebar, CommonModule, Chat, Modal, ToastContainerComponent, ChatHistory],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements AfterViewInit {
  constructor(
    public sidebarService: SidebarService,
    public authService: AuthService
  ) {}

  showDeleteModal = false;
  showLogoutModal = false;
  showChatHistory = false; 
  sidebarReady = false;
  
  chatToDelete: number | null = null;

  ngAfterViewInit() {
    setTimeout(() => {
      this.sidebarReady = true;
    }, 50);
  }

  openDeleteModal(id: number) {
    this.chatToDelete = id;
    this.showDeleteModal = true;
  }
  openLogoutModal() {
  this.showLogoutModal = true;
}

  confirmLogout() {
    this.showLogoutModal = false;
    this.authService.logout();
  }
  confirmDelete() {
    this.showDeleteModal = false;
  }

  cancelDelete() {
    this.showDeleteModal = false;
  }
    openChatHistory() {
    this.showChatHistory = true;   
  }

  closeChatHistory() {
    this.showChatHistory = false; 
  }

}
