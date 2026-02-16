import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ChatMessage {
  id: number;
  title: string;
  preview?: string;
  timestamp?: string;
  date?: string;
}

@Component({
  selector: 'app-chat-history',
  imports: [CommonModule],
  templateUrl: './chat-history.html',
  styleUrl: './chat-history.scss',
})
export class ChatHistory {
  @Output() chatSelected = new EventEmitter<number>();
  @Output() chatDeleted = new EventEmitter<number>();
  @Output() newChatClicked = new EventEmitter<void>();
  @Output() logoutClicked = new EventEmitter<void>();

  searchQuery: string = '';
  selectedChatId: number | null = null;
  isCollapsed: boolean = false;
  isDropdownOpen: boolean = false;
  
  recentChats: ChatMessage[] = [
    {
      id: 1,
      title: 'Hey, can we review the difference'
    },
    {
      id: 2,
      title: 'Power BI Troubleshooting'
    },
    {
      id: 3,
      title: 'Microsoft 365 Productivity Hacks'
    },
    {
      id: 4,
      title: 'Azure Cloud Services (AZ-900)'
    },
    {
      id: 5,
      title: 'Power Platform & DAX'
    },
    {
      id: 6,
      title: 'Security & Compliance (SC-900)'
    },
    {
      id: 7,
      title: 'Difference between a Report and'
    },
    {
      id: 8,
      title: 'Role of Dataverse in the Power'
    },
    {
      id: 9,
      title: 'Primary benefit of using Azure'
    }
  ];

  get filteredChats(): ChatMessage[] {
    if (!this.searchQuery.trim()) {
      return this.recentChats;
    }
    
    const query = this.searchQuery.toLowerCase();
    return this.recentChats.filter(chat =>
      chat.title.toLowerCase().includes(query)
    );
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  closeDropdown(): void {
    this.isDropdownOpen = false;
  }

  selectChat(chatId: number): void {
    this.selectedChatId = chatId;
    this.chatSelected.emit(chatId);
  }

  deleteChat(event: Event, chatId: number): void {
    event.stopPropagation();
    // Remove from array
    this.recentChats = this.recentChats.filter(chat => chat.id !== chatId);
    
    // Clear selection if deleted chat was selected
    if (this.selectedChatId === chatId) {
      this.selectedChatId = null;
    }
    
    this.chatDeleted.emit(chatId);
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery = target.value;
  }

  onNewChat(): void {
    this.selectedChatId = null;
    this.newChatClicked.emit();
  }

  onChatHistory(): void {
    // Handle chat history view
    console.log('Chat History clicked');
  }

  onLogout(): void {
    this.closeDropdown();
    this.logoutClicked.emit();
    // Handle logout logic
    console.log('Logging out...');
  }
}