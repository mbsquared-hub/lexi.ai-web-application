export interface Message {
  id: number;
  role: 'user' | 'lexi';
  content: string;
  images?: string[];
}