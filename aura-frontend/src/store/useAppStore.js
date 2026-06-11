import { create } from 'zustand';

export const useAppStore = create((set, get) => ({
  route: window.location.pathname === '/' ? '/dashboard' : window.location.pathname,
  messages: [],
  setRoute: (route) => {
    window.history.pushState({}, '', route);
    set({ route });
  },
  addMessage: (message) => set({ messages: [...get().messages, message] }),
  updateLastAssistant: (text) => {
    const messages = [...get().messages];
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') last.content += text;
    set({ messages });
  },
  resetChat: () => set({ messages: [] })
}));
