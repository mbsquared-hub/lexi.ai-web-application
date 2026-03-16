import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { MsalGuard } from '@azure/msal-angular';
export const routes: Routes = [
  {path: 'dashboard', component: Dashboard, canActivate: [MsalGuard]},
  {path: '', redirectTo: '/dashboard', pathMatch: 'full'}
];
