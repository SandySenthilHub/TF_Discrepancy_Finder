import { create } from 'zustand';
import { Session, Document } from '../types';
import { sessionsAPI, documentsAPI } from '../services/api';

interface SessionState {
  sessions: Session[];
  currentSession: Session | null;
  isLoading: boolean;
  error: string | null;
  createSession: (data: { cifNumber: string; lcNumber: string; lifecycle: string }) => Promise<Session>;
  loadSessions: () => Promise<void>;
  setCurrentSession: (session: Session | null) => void;
  updateSessionStatus: (sessionId: string, status: Session['status']) => Promise<void>;
  addDocumentToSession: (sessionId: string, document: Document) => void;
  uploadDocument: (sessionId: string, file: File) => Promise<any>;
  incrementIteration: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearError: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSession: null,
  isLoading: false,
  error: null,

  createSession: async (data) => {
    set({ isLoading: true, error: null });
    
    try {
      const newSession = await sessionsAPI.create(data);
      
      // Add documents array if not present
      const sessionWithDocs = {
        ...newSession,
        documents: newSession.documents || []
      };
      
      set(state => ({
        sessions: [sessionWithDocs, ...state.sessions],
        currentSession: sessionWithDocs,
        isLoading: false,
      }));
      
      return sessionWithDocs;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create session';
      set({ isLoading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  loadSessions: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const sessions = await sessionsAPI.getAll();
      
      // Ensure all sessions have documents array
      const sessionsWithDocs = sessions.map((session: any) => ({
        ...session,
        documents: session.documents || []
      }));
      
      set({ sessions: sessionsWithDocs, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load sessions';
      set({ isLoading: false, error: errorMessage });
      console.error('Error loading sessions:', error);
    }
  },

  setCurrentSession: (session) => {
    set({ currentSession: session });
  },

  updateSessionStatus: async (sessionId, status) => {
    try {
      const updatedSession = await sessionsAPI.updateStatus(sessionId, status);
      
      set(state => ({
        sessions: state.sessions.map(session =>
          session.id === sessionId ? { ...updatedSession, documents: session.documents } : session
        ),
        currentSession: state.currentSession?.id === sessionId
          ? { ...updatedSession, documents: state.currentSession.documents }
          : state.currentSession,
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update session status';
      set({ error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  addDocumentToSession: (sessionId, document) => {
    set(state => ({
      sessions: state.sessions.map(session =>
        session.id === sessionId
          ? { ...session, documents: [...(session.documents || []), document] }
          : session
      ),
      currentSession: state.currentSession?.id === sessionId
        ? { ...state.currentSession, documents: [...(state.currentSession.documents || []), document] }
        : state.currentSession,
    }));
  },

  uploadDocument: async (sessionId, file) => {
    try {
      const response = await documentsAPI.upload(sessionId, file);
      
      // Add document to session
      get().addDocumentToSession(sessionId, response.document);
      
      // Update session status to uploading if it's still created
      const session = get().sessions.find(s => s.id === sessionId);
      if (session && session.status === 'created') {
        await get().updateSessionStatus(sessionId, 'uploading');
      }
      
      return response;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to upload document';
      set({ error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  incrementIteration: async (sessionId) => {
    try {
      const updatedSession = await sessionsAPI.incrementIteration(sessionId);
      
      set(state => ({
        sessions: state.sessions.map(session =>
          session.id === sessionId ? { ...updatedSession, documents: session.documents } : session
        ),
        currentSession: state.currentSession?.id === sessionId
          ? { ...updatedSession, documents: state.currentSession.documents }
          : state.currentSession,
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to increment iteration';
      set({ error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  deleteSession: async (sessionId) => {
    try {
      await sessionsAPI.delete(sessionId);
      
      set(state => ({
        sessions: state.sessions.filter(session => session.id !== sessionId),
        currentSession: state.currentSession?.id === sessionId ? null : state.currentSession,
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to delete session';
      set({ error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));