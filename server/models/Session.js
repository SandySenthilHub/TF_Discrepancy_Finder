import { sql, getPool } from '../config/database.js';
import fs from 'fs';
import path from 'path';

export class SessionModel {
  static async createSession(sessionData) {
    try {
      const pool = await getPool();
      const request = pool.request();
      
      const result = await request
        .input('cifNumber', sql.VarChar(50), sessionData.cifNumber)
        .input('lcNumber', sql.VarChar(50), sessionData.lcNumber)
        .input('lifecycle', sql.VarChar(100), sessionData.lifecycle)
        .input('userId', sql.VarChar(50), sessionData.userId)
        .input('status', sql.VarChar(20), 'created')
        .input('createdAt', sql.DateTime, new Date())
        .input('updatedAt', sql.DateTime, new Date())
        .query(`
          INSERT INTO ingestion_session 
          (cifNumber, lcNumber, lifecycle, userId, status, createdAt, updatedAt, iterations)
          OUTPUT INSERTED.*
          VALUES (@cifNumber, @lcNumber, @lifecycle, @userId, @status, @createdAt, @updatedAt, 0)
        `);
      
      return result.recordset[0];
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  static async getAllSessions(userId = null) {
    try {
      const pool = await getPool();
      const request = pool.request();
      
      let query = `
        SELECT s.*, 
               COUNT(d.id) as documentCount
        FROM ingestion_session s
        LEFT JOIN ingestion_document_raw d ON s.id = d.sessionId
      `;
      
      if (userId) {
        query += ' WHERE s.userId = @userId';
        request.input('userId', sql.VarChar(50), userId);
      }
      
      query += ' GROUP BY s.id, s.cifNumber, s.lcNumber, s.lifecycle, s.status, s.createdAt, s.updatedAt, s.userId, s.iterations ORDER BY s.createdAt DESC';
      
      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      console.error('Error fetching sessions:', error);
      throw error;
    }
  }

  static async getSessionById(sessionId) {
    try {
      const pool = await getPool();
      const request = pool.request();
      
      const result = await request
        .input('sessionId', sql.VarChar(50), sessionId)
        .query(`
          SELECT s.*, 
                 COUNT(d.id) as documentCount
          FROM ingestion_session s
          LEFT JOIN ingestion_document_raw d ON s.id = d.sessionId
          WHERE s.id = @sessionId
          GROUP BY s.id, s.cifNumber, s.lcNumber, s.lifecycle, s.status, s.createdAt, s.updatedAt, s.userId, s.iterations
        `);
      
      return result.recordset[0];
    } catch (error) {
      console.error('Error fetching session:', error);
      throw error;
    }
  }

  static async updateSessionStatus(sessionId, status) {
    try {
      const pool = await getPool();
      const request = pool.request();
      
      const result = await request
        .input('sessionId', sql.VarChar(50), sessionId)
        .input('status', sql.VarChar(20), status)
        .input('updatedAt', sql.DateTime, new Date())
        .query(`
          UPDATE ingestion_session 
          SET status = @status, updatedAt = @updatedAt
          OUTPUT INSERTED.*
          WHERE id = @sessionId
        `);
      
      return result.recordset[0];
    } catch (error) {
      console.error('Error updating session status:', error);
      throw error;
    }
  }

  static async incrementIteration(sessionId) {
    try {
      const pool = await getPool();
      const request = pool.request();
      
      const result = await request
        .input('sessionId', sql.VarChar(50), sessionId)
        .input('updatedAt', sql.DateTime, new Date())
        .query(`
          UPDATE ingestion_session 
          SET iterations = iterations + 1, updatedAt = @updatedAt
          OUTPUT INSERTED.*
          WHERE id = @sessionId
        `);
      
      return result.recordset[0];
    } catch (error) {
      console.error('Error incrementing iteration:', error);
      throw error;
    }
  }

  static async deleteSession(sessionId) {
    try {
      const pool = await getPool();
      const request = pool.request();
      
      // First get all documents in the session to clean up files
      const documentsResult = await request
        .input('sessionId', sql.VarChar(50), sessionId)
        .query(`
          SELECT filePath FROM ingestion_document_raw 
          WHERE sessionId = @sessionId
        `);
      
      // Delete all physical files
      const uploadsDir = process.env.UPLOAD_PATH || './uploads';
      for (const doc of documentsResult.recordset) {
        try {
          const fullPath = path.join(uploadsDir, doc.filePath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log(`Deleted file: ${fullPath}`);
          }
        } catch (fileError) {
          console.error('Error deleting file:', fileError);
          // Continue with other files
        }
      }
      
      // Get session info before deletion
      const session = await this.getSessionById(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }
      
      // Delete session from database (CASCADE will handle related records)
      const deleteResult = await request.query(`
        DELETE FROM ingestion_session 
        WHERE id = @sessionId
      `);
      
      console.log(`Session deleted: ${sessionId} with ${documentsResult.recordset.length} documents`);
      return { 
        success: true, 
        deletedSession: session,
        deletedDocuments: documentsResult.recordset.length 
      };
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }
}