import mongoose from 'mongoose';

/**
 * Fix old cancelled sales that were soft-deleted (isDeleted: true).
 * Updates them to isDeleted: false so they appear in the list.
 */
export const fixCancelledSales = async () => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      console.log('Database not connected, skipping fix');
      return;
    }

    const collection = db.collection('sales');

    // Update old cancelled sales: set isDeleted to false, keep status as cancelled
    const result = await collection.updateMany(
      { isDeleted: true, status: 'cancelled' },
      { $set: { isDeleted: false } }
    );

    if (result.modifiedCount > 0) {
      console.log(`✅ Fixed ${result.modifiedCount} old cancelled sales — they now appear in the list`);
    } else {
      console.log('No old cancelled sales to fix');
    }
  } catch (error) {
    console.error('Error fixing cancelled sales:', error.message);
  }
};