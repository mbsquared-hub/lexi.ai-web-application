import { Routes } from '@angular/router';
import { Chat } from './chat/chat/chat';
import { Sidebar } from './navigations/sidebar/sidebar';
import { Navbar } from './navigations/navbar/navbar';
import { Dashboard } from './dashboard/dashboard';

export const routes: Routes = [
  // {path: 'chat', component: Chat},
  // {path: 'navbar', component: Navbar},
  // {path: 'sidebar', component: Sidebar},
  {path: 'dashboard', component: Dashboard},
  {path: '', redirectTo: '/dashboard', pathMatch: 'full'} // Redirect to navbar as the default route
];
