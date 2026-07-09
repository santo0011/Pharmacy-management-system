import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { purchaseService } from '../../services/purchaseService';

export const fetchPurchases = createAsyncThunk('purchases/fetchAll', async (params, { rejectWithValue }) => {
  try { const { data } = await purchaseService.getPurchases(params); return data; }
  catch (error) { return rejectWithValue(error.response?.data?.message || 'Failed to fetch purchases'); }
});

export const fetchPurchase = createAsyncThunk('purchases/fetchOne', async (id, { rejectWithValue }) => {
  try { const { data } = await purchaseService.getPurchase(id); return data.data; }
  catch (error) { return rejectWithValue(error.response?.data?.message || 'Failed to fetch purchase'); }
});

export const createPurchase = createAsyncThunk('purchases/create', async (formData, { rejectWithValue }) => {
  try { const { data } = await purchaseService.createPurchase(formData); return data.data; }
  catch (error) { return rejectWithValue(error.response?.data?.message || 'Failed to create purchase'); }
});

export const updatePurchase = createAsyncThunk('purchases/update', async ({ id, formData }, { rejectWithValue }) => {
  try { const { data } = await purchaseService.updatePurchase(id, formData); return data.data; }
  catch (error) { return rejectWithValue(error.response?.data?.message || 'Failed to update purchase'); }
});

export const deletePurchase = createAsyncThunk('purchases/delete', async (id, { rejectWithValue }) => {
  try { await purchaseService.deletePurchase(id); return id; }
  catch (error) { return rejectWithValue(error.response?.data?.message || 'Failed to delete purchase'); }
});

export const fetchPurchaseStats = createAsyncThunk('purchases/fetchStats', async (_, { rejectWithValue }) => {
  try { const { data } = await purchaseService.getPurchaseStats(); return data.data; }
  catch (error) { return rejectWithValue(error.response?.data?.message || 'Failed to fetch stats'); }
});

export const addPurchasePayment = createAsyncThunk('purchases/addPayment', async ({ id, paymentData }, { rejectWithValue }) => {
  try { const { data } = await purchaseService.addPurchasePayment(id, paymentData); return data.data; }
  catch (error) { return rejectWithValue(error.response?.data?.message || 'Failed to add payment'); }
});

export const fetchPurchasePayments = createAsyncThunk('purchases/fetchPayments', async (id, { rejectWithValue }) => {
  try { const { data } = await purchaseService.getPurchasePayments(id); return data.data; }
  catch (error) { return rejectWithValue(error.response?.data?.message || 'Failed to fetch payments'); }
});

export const fetchSupplierLedger = createAsyncThunk('purchases/fetchSupplierLedger', async ({ supplierId, params }, { rejectWithValue }) => {
  try { const { data } = await purchaseService.getSupplierLedger(supplierId, params); return data; }
  catch (error) { return rejectWithValue(error.response?.data?.message || 'Failed to fetch ledger'); }
});

export const fetchSupplierDueInvoices = createAsyncThunk('purchases/fetchSupplierDueInvoices', async (supplierId, { rejectWithValue }) => {
  try { const { data } = await purchaseService.getSupplierDueInvoices(supplierId); return data.data; }
  catch (error) { return rejectWithValue(error.response?.data?.message || 'Failed to fetch due invoices'); }
});

const purchaseSlice = createSlice({
  name: 'purchases',
  initialState: {
    items: [],
    total: 0,
    loading: false,
    error: null,
    selectedPurchase: null,
    payments: [],
    stats: null,
    supplierLedger: null,
    ledgerLoading: false,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    clearSelectedPurchase: (state) => { state.selectedPurchase = null; state.payments = []; },
    clearSupplierLedger: (state) => { state.supplierLedger = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPurchases.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchPurchases.fulfilled, (state, action) => { state.loading = false; state.items = action.payload.data; state.total = action.payload.pagination?.total || 0; })
      .addCase(fetchPurchases.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchPurchase.pending, (state) => { state.loading = true; })
      .addCase(fetchPurchase.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedPurchase = action.payload.purchase || action.payload;
        state.payments = action.payload.payments || [];
      })
      .addCase(fetchPurchase.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(createPurchase.fulfilled, (state, action) => { state.items.unshift(action.payload); state.total += 1; })
      .addCase(updatePurchase.fulfilled, (state, action) => {
        const idx = state.items.findIndex((i) => i._id === action.payload._id);
        if (idx !== -1) state.items[idx] = action.payload;
        if (state.selectedPurchase?._id === action.payload._id) state.selectedPurchase = action.payload;
      })
      .addCase(deletePurchase.fulfilled, (state, action) => { state.items = state.items.filter((i) => i._id !== action.payload); state.total -= 1; })
      .addCase(fetchPurchaseStats.fulfilled, (state, action) => { state.stats = action.payload; })
      .addCase(addPurchasePayment.fulfilled, (state, action) => {
        state.payments.unshift(action.payload);
        if (state.selectedPurchase) {
          state.selectedPurchase.paidAmount += action.payload.amount;
          state.selectedPurchase.dueAmount = Math.max(0, state.selectedPurchase.grandTotal - state.selectedPurchase.paidAmount);
          state.selectedPurchase.paymentStatus = state.selectedPurchase.dueAmount <= 0 ? 'paid' : 'partial';
        }
      })
      .addCase(fetchPurchasePayments.fulfilled, (state, action) => { state.payments = action.payload; })
      .addCase(fetchSupplierLedger.pending, (state) => { state.ledgerLoading = true; })
      .addCase(fetchSupplierLedger.fulfilled, (state, action) => { state.ledgerLoading = false; state.supplierLedger = action.payload; })
      .addCase(fetchSupplierLedger.rejected, (state) => { state.ledgerLoading = false; });
  },
});

export const { clearError, clearSelectedPurchase, clearSupplierLedger } = purchaseSlice.actions;
export default purchaseSlice.reducer;