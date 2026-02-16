import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard/dashboard';
import { Navbar } from './navbar/navbar/navbar';
import { ChatHistory } from './chat-history/chat-history/chat-history';

export const routes: Routes = [
  // Redirect root to dashboard
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: Dashboard },
  { path: 'navbar', component: Navbar },
  { path: 'chat-history', component: ChatHistory },
  // Catch all
  { path: '**', redirectTo: 'dashboard' } 
];