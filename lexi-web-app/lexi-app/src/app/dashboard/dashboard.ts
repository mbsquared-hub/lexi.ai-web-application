import { Component } from '@angular/core';
import { Navbar } from '../navigations/navbar/navbar';
import { SidebarService } from '../services/sidebar.service';
import { Sidebar } from '../navigations/sidebar/sidebar';
// import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Chat } from '../chat/chat/chat';
import { Modal } from '../modal/modal';
@Component({
  selector: 'app-dashboard',
  imports: [Navbar, Sidebar, CommonModule, Chat, Modal],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  constructor(public sidebarService: SidebarService) {}

  showDeleteModal = false;
  chatToDelete: number | null = null;

  openDeleteModal(id: number) {
    this.chatToDelete = id;
    this.showDeleteModal = true;
  }

  confirmDelete() {
    // emit back to sidebar or handle via a shared service
    this.showDeleteModal = false;
  }

  cancelDelete() {
    this.showDeleteModal = false;
  }

}
