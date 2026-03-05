import { Component, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-navbar',
  imports: [CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  isDropdownOpen = false;
  constructor(
    private router: Router, 
    public sidebarService: SidebarService,
    public themeService: ThemeService  // add this
  ) {}

  goHome() { this.router.navigate(['/']); }
  goGithub() {window.open('https://github.com/mbsquared-hub', '_blank');}  
  toggleDropdown() { this.isDropdownOpen = !this.isDropdownOpen; }

  @HostListener('document:click', ['$event'])
  onDocumentClick({target}: MouseEvent) {
    if (!(target as HTMLElement).closest('.profile-container')) {
      this.isDropdownOpen = false;
    }
  }



}
