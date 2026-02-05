import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './navbar/navbar/navbar';
// import { Dashboard } from './dashboard/dashboard/dashboard';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet,Navbar],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('lexi-web-app');
}
