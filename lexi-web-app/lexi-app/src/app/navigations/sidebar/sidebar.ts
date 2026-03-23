import { Component, Output, EventEmitter, Input, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarService } from '../../services/sidebar.service';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { ConversationService } from '../../services/conversation.service';
import { ConversationDto } from '../../model/conversation.model';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, FormsModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar implements OnInit {

  constructor(
    public sidebarService: SidebarService,
    public themeService: ThemeService,
    public authService: AuthService,
  ) {}

  private conversationService = inject(ConversationService);
  private cdr = inject(ChangeDetectorRef);

  conversations: ConversationDto[] = [];
  searchText = '';
  isLoading = false;

  @Output() deleteModalOpen = new EventEmitter<string>();
  @Output() logoutModalOpen = new EventEmitter<void>();
  @Output() openChatHistory = new EventEmitter<void>();
  @Output() newChat = new EventEmitter<void>();
  @Output() conversationSelected = new EventEmitter<string>();

  @Input() isChatHistoryOpen = false;

  ngOnInit() {
    this.loadRecentConversations();
  }

  // ─── silent = true → no loading spinner, used for background refreshes ───
  loadRecentConversations(silent = false) {
    if (!silent) {
      this.isLoading = true;
      this.cdr.detectChanges();
    }

    this.conversationService.getConversations().subscribe({
      next: (data) => {
        this.conversations = data
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 5);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load recent conversations', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get filteredConversations(): ConversationDto[] {
    if (!this.searchText.trim()) return this.conversations;
    const q = this.searchText.toLowerCase();
    return this.conversations.filter(c =>
      c.title.toLowerCase().includes(q)
    );
  }

  openConversation(conversation: ConversationDto) {
    this.conversationSelected.emit(conversation.id);
  }

  openDeleteModal(id: string) {
    this.deleteModalOpen.emit(id);
  }

  removeConversation(id: string) {
    this.conversations = this.conversations.filter(c => c.id !== id);
    this.cdr.detectChanges();
  }

  toggleSidebar() {
    this.sidebarService.toggle();
  }

  get username(): string {
    return this.authService.getUserName() || 'User';
  }

  get userEmail(): string {
    return this.authService.getUserEmail() || '';
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  openLogoutModal() {
    this.logoutModalOpen.emit();
  }
}