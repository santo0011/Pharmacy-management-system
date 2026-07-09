import mongoose from 'mongoose';

/**
 * Drop old problematic indexes and ensure new ones are created.
 * Run this on server startup.
 */
export const syncMedicineIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      console.log('Database not connected yet, skipping index sync');
      return;
    }

    const collection = db.collection('medicines');

    // Get existing indexes
    const indexes = await collection.indexes();
    console.log('Current medicine indexes:', indexes.map(i => i.name));

    // Drop any existing barcode_1_pharmacyId_1 index (old sparse or broken)
    try {
      await collection.dropIndex('barcode_1_pharmacyId_1');
      console.log('Dropped old barcode_1_pharmacyId_1 index');
    } catch (err) {
      // Index may not exist, that's fine
    }

    // Update all existing documents where barcode is '' to null
    const updateResult = await collection.updateMany(
      { barcode: '' },
      { $set: { barcode: null } }
    );
    if (updateResult.modifiedCount > 0) {
      console.log(`Updated ${updateResult.modifiedCount} documents with empty barcode to null`);
    }

    // Create the new partial unique index directly (bypasses syncIndexes limitation)
    try {
      await collection.createIndex(
        { barcode: 1, pharmacyId: 1 },
        {
          unique: true,
          partialFilterExpression: { barcode: { $gt: '' } },
          name: 'barcode_1_pharmacyId_1',
        }
      );
      console.log('Created new partial unique barcode index');
    } catch (err) {
      console.log('Barcode index may already exist with correct definition:', err.message);
    }

    console.log('Medicine indexes synced successfully');
    const updatedIndexes = await collection.indexes();
    // console.log('Updated medicine indexes:', updatedIndexes.map(i => i.name));
  } catch (error) {
    console.error('Error syncing medicine indexes:', error.message);
  }
};
