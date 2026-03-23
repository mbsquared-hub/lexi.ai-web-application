import { Component, AfterViewInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { Navbar } from '../navigations/navbar/navbar';
import { SidebarService } from '../services/sidebar.service';
import { Sidebar } from '../navigations/sidebar/sidebar';
import { CommonModule } from '@angular/common';
import { Chat } from '../chat/chat/chat';
import { Modal } from '../modal/modal';
import { AuthService } from '../services/auth.service';
import { ToastContainerComponent } from '../notifications/toast-container.component';
import { ChatHistory } from '../chat-history/chat-history';
import { ConversationService } from '../services/conversation.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-dashboard',
  imports: [Navbar, Sidebar, CommonModule, Chat, Modal, ToastContainerComponent, ChatHistory],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements AfterViewInit {

  constructor(
    public sidebarService: SidebarService,
    public authService: AuthService,
    private conversationService: ConversationService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef  // ← added
  ) {}

  @ViewChild(Chat) chatComponent!: Chat;
  @ViewChild(Sidebar) sidebarComponent!: Sidebar;

  showDeleteModal = false;
  showLogoutModal = false;
  showChatHistory = false;
  sidebarReady = false;

  conversationToDelete: string | null = null;

  ngAfterViewInit() {
    setTimeout(() => {
      this.sidebarReady = true;
    }, 50);
  }

  // ─── Conversation selection ───────────────────────────────────────────────
  onConversationSelected(conversationId: string) {
    this.showChatHistory = false;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.chatComponent?.loadConversation(conversationId);
    }, 50);
  }

  // ─── New chat ─────────────────────────────────────────────────────────────
  onNewChat() {
    this.showChatHistory = false;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.chatComponent?.newChat();
      this.sidebarComponent?.loadRecentConversations(true); // ← silent, no loading flash
    }, 0);
  }

  // ─── Chat history ─────────────────────────────────────────────────────────
  openChatHistory() {
    this.showChatHistory = true;
  }

  closeChatHistory() {
    this.showChatHistory = false;
  }

  // ─── Delete (from sidebar) ────────────────────────────────────────────────
  openDeleteModal(id: string) {
    this.conversationToDelete = id;
    this.showDeleteModal = true;
  }

  confirmDelete() {
    if (!this.conversationToDelete) {
      this.showDeleteModal = false;
      return;
    }
    this.conversationService.deleteConversation(this.conversationToDelete).subscribe({
      next: () => {
        this.sidebarComponent?.removeConversation(this.conversationToDelete!);
        this.toastService.success('Deleted', 'Conversation has been deleted.');

        if (this.chatComponent?.currentConversationId === this.conversationToDelete) {
          this.chatComponent.newChat();
        }

        this.conversationToDelete = null;
        this.showDeleteModal = false;
      },
      error: (err) => {
        console.error('Delete failed', err);
        this.toastService.error('Delete failed', 'Please try again.');
        this.showDeleteModal = false;
      }
    });
  }

  cancelDelete() {
    this.conversationToDelete = null;
    this.showDeleteModal = false;
  }

  // ─── Logout ───────────────────────────────────────────────────────────────
  openLogoutModal() {
    this.showLogoutModal = true;
  }

  confirmLogout() {
    this.showLogoutModal = false;
    this.authService.logout();
  }

  // ─── Refresh sidebar after message sent ──────────────────────────────────
  onConversationUpdated() {
    this.sidebarComponent?.loadRecentConversations(true); // ← silent, no loading flash
  }
}