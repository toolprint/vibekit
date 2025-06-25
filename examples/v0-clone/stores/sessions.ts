import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Session {
  id: string;
  sessionId?: string;
  name: string;
  tunnelUrl?: string;
  messages: Message[];
}

interface SessionStore {
  sessions: Session[];
  currentSessionId: string | null;
  createSession: (
    session: Omit<Session, "id" | "createdAt" | "updatedAt">
  ) => Session;
  updateSession: (
    id: string,
    updates: Partial<Omit<Session, "id" | "createdAt">>
  ) => void;
  deleteSession: (id: string) => void;
  setCurrentSession: (id: string | null) => void;
  addMessage: (id: string, message: Omit<Message, "id" | "createdAt">) => void;
  deleteMessage: (sessionId: string, messageId: string) => void;
  clearMessages: (id: string) => void;
  getSessions: () => Session[];
  getSessionById: (id: string) => Session | undefined;
  getCurrentSession: () => Session | undefined;
  clear: () => void;
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSessionId: null,

      createSession: (session) => {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        const newSession = {
          ...session,
          id,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          sessions: [...state.sessions, newSession],
        }));
        return newSession;
      },

      updateSession: (id, updates) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === id
              ? { ...session, ...updates, updatedAt: new Date().toISOString() }
              : session
          ),
        }));
      },

      deleteSession: (id) => {
        set((state) => ({
          sessions: state.sessions.filter((session) => session.id !== id),
          currentSessionId:
            state.currentSessionId === id ? null : state.currentSessionId,
        }));
      },

      setCurrentSession: (id) => {
        set({ currentSessionId: id });
      },

      addMessage: (id, message) => {
        const newMessage: Message = {
          ...message,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === id
              ? {
                  ...session,
                  messages: [...(session.messages || []), newMessage],
                  updatedAt: new Date().toISOString(),
                }
              : session
          ),
        }));
      },

      deleteMessage: (sessionId, messageId) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  messages: session.messages.filter(
                    (msg) => msg.id !== messageId
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : session
          ),
        }));
      },

      clearMessages: (id) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === id
              ? {
                  ...session,
                  messages: [],
                  updatedAt: new Date().toISOString(),
                }
              : session
          ),
        }));
      },

      getSessions: () => get().sessions,

      getSessionById: (id) =>
        get().sessions.find((session) => session.id === id),

      getCurrentSession: () => {
        const state = get();
        return state.currentSessionId
          ? state.sessions.find(
              (session) => session.id === state.currentSessionId
            )
          : undefined;
      },

      clear: () => set({ sessions: [], currentSessionId: null }),
    }),
    {
      name: "sessions-store", // key in localStorage
    }
  )
);
