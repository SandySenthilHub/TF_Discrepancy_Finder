import express from 'express';
import { SessionModel } from '../models/Session.js';
import { DocumentModel } from '../models/Document.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all sessions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.role === 'admin' ? null : req.user.userId;
    const sessions = await SessionModel.getAllSessions(userId);
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Create new session
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { cifNumber, lcNumber, lifecycle } = req.body;
    
    if (!cifNumber || !lcNumber || !lifecycle) {
      return res.status(400).json({ error: 'CIF number, LC number, and lifecycle are required' });
    }

    const sessionData = {
      cifNumber,
      lcNumber,
      lifecycle,
      userId: req.user.userId
    };

    const newSession = await SessionModel.createSession(sessionData);
    res.status(201).json(newSession);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get session by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const session = await SessionModel.getSessionById(req.params.id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if user has access to this session
    if (req.user.role !== 'admin' && session.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get documents for this session
    const documents = await DocumentModel.getDocumentsBySession(session.id);
    
    res.json({
      ...session,
      documents
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Update session status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const session = await SessionModel.getSessionById(req.params.id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if user has access to this session
    if (req.user.role !== 'admin' && session.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedSession = await SessionModel.updateSessionStatus(req.params.id, status);
    res.json(updatedSession);
  } catch (error) {
    console.error('Error updating session status:', error);
    res.status(500).json({ error: 'Failed to update session status' });
  }
});

// Increment session iteration
router.patch('/:id/iterate', authenticateToken, async (req, res) => {
  try {
    const session = await SessionModel.getSessionById(req.params.id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if user has access to this session
    if (req.user.role !== 'admin' && session.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedSession = await SessionModel.incrementIteration(req.params.id);
    res.json(updatedSession);
  } catch (error) {
    console.error('Error incrementing iteration:', error);
    res.status(500).json({ error: 'Failed to increment iteration' });
  }
});

// Delete session
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    const session = await SessionModel.getSessionById(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if user has access to this session
    if (req.user.role !== 'admin' && session.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if session can be deleted (not completed or frozen)
    if (session.status === 'completed') {
      return res.status(400).json({ error: 'Cannot delete completed sessions' });
    }

    // Delete the session
    const result = await SessionModel.deleteSession(sessionId);
    
    console.log(`Session deleted by user ${req.user.userId}: ${sessionId}`);
    
    res.json({
      message: 'Session deleted successfully',
      deletedSession: result.deletedSession,
      deletedDocuments: result.deletedDocuments
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;