/**
 * Database transaction wrapper utilities
 */

import { sql } from '../config/db.js';
import { logger } from './errorHandler.js';

/**
 * Execute multiple queries in a transaction
 * @param {Function} callback - Async function that receives sql client
 * @returns {Promise} Result of the transaction
 */
export const transaction = async (callback) => {
  try {
    // Begin transaction
    await sql`BEGIN`;
    
    logger.debug('Transaction started');
    
    // Execute callback with sql client
    const result = await callback(sql);
    
    // Commit transaction
    await sql`COMMIT`;
    
    logger.debug('Transaction committed');
    
    return result;
  } catch (error) {
    // Rollback on error
    try {
      await sql`ROLLBACK`;
      logger.warn('Transaction rolled back', { error: error.message });
    } catch (rollbackError) {
      logger.error('Rollback failed', rollbackError);
    }
    
    throw error;
  }
};

/**
 * Execute a query with retry logic
 * @param {Function} queryFn - Function that returns a promise
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Delay between retries in ms
 */
export const retryQuery = async (queryFn, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on validation errors
      if (error.statusCode && error.statusCode < 500) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        logger.warn(`Query failed, retrying (${attempt}/${maxRetries})`, {
          error: error.message
        });
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }
  
  logger.error('Query failed after all retries', lastError);
  throw lastError;
};

/**
 * Batch insert with transaction
 * @param {string} table - Table name
 * @param {Array} records - Array of record objects
 * @param {Array} columns - Column names
 * @returns {Promise} Insert result
 */
export const batchInsert = async (table, records, columns) => {
  if (!records || records.length === 0) {
    return { inserted: 0 };
  }

  return transaction(async (tx) => {
    const results = [];
    
    for (const record of records) {
      const values = columns.map(col => record[col]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const columnList = columns.join(', ');
      
      const query = `INSERT INTO ${table} (${columnList}) VALUES (${placeholders}) RETURNING id`;
      const result = await tx.unsafe(query, values);
      results.push(result[0]);
    }
    
    return {
      inserted: results.length,
      ids: results.map(r => r.id)
    };
  });
};

/**
 * Batch update with transaction
 * @param {string} table - Table name
 * @param {Array} updates - Array of {id, data} objects
 * @param {string} idColumn - ID column name (default: 'id')
 * @returns {Promise} Update result
 */
export const batchUpdate = async (table, updates, idColumn = 'id') => {
  if (!updates || updates.length === 0) {
    return { updated: 0 };
  }

  return transaction(async (tx) => {
    let updated = 0;
    
    for (const update of updates) {
      const { id, data } = update;
      const columns = Object.keys(data);
      const values = Object.values(data);
      
      const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
      const query = `UPDATE ${table} SET ${setClause} WHERE ${idColumn} = $${columns.length + 1}`;
      
      await tx.unsafe(query, [...values, id]);
      updated++;
    }
    
    return { updated };
  });
};
