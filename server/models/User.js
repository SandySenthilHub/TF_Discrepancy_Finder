import { sql, getPool } from '../config/database.js';
import bcrypt from 'bcryptjs';

export class UserModel {
  static async createUser(userData) {
    try {
      const pool = await getPool();
      const request = pool.request();
      
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const result = await request
        .input('email', sql.VarChar(255), userData.email)
        .input('name', sql.VarChar(255), userData.name)
        .input('password', sql.VarChar(255), hashedPassword)
        .input('role', sql.VarChar(20), userData.role || 'user')
        .input('createdAt', sql.DateTime, new Date())
        .query(`
          INSERT INTO users (email, name, password, role, createdAt)
          OUTPUT INSERTED.id, INSERTED.email, INSERTED.name, INSERTED.role, INSERTED.createdAt
          VALUES (@email, @name, @password, @role, @createdAt)
        `);
      
      return result.recordset[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const pool = await getPool();
      const request = pool.request();
      
      const result = await request
        .input('email', sql.VarChar(255), email)
        .query('SELECT * FROM users WHERE email = @email');
      
      return result.recordset[0];
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  static async findById(userId) {
    try {
      const pool = await getPool();
      const request = pool.request();
      
      const result = await request
        .input('userId', sql.VarChar(50), userId)
        .query('SELECT id, email, name, role, createdAt FROM users WHERE id = @userId');
      
      return result.recordset[0];
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  static async validatePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}