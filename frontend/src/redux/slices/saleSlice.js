import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { saleService } from '../../services/saleService';

export const fetchSales = createAsyncThunk('sales/fetchAll', async (params, { rejectWithValue }) => {
  try { const { data } = await saleService.getSales(params); return data; }
  catch (error) { return rejectWithValue(error.response?.data?.message || 'Failed to fetch sales'); }
});

export const fetchSale = createAsyncThunk('sales/fetchOne', async (id, { rejectWithValue }) => {
  try { const { data } = await saleService.getSale(id); return data.data; }
  catch (error) { return rejectWithValue(error.response?.data?.message || 'Failed to fetch sale'); }
});

export const createSale = createAsyncThunk('sales/create', async (formData, { rejectWithValue }) => {
  try { const { data } = await saleService.createSale(formData); return data.data; }
  catch (error) { return rejectWithValue(error.response?.data?.message || 'Failed to create sale'); }
});

export const deleteSale = createAsyncThunk('sales/delete', async (id, { rejectWithValue }) => {
  try { await saleService.deleteSale(id); return id; }
  catch (error) { return rejectWithValue(error.response?.data?.message || 'Failed to delete sale'); }
});

export const returnSale = createAsyncThunk('sales/return', async (id, { rejectWithValue }) => {
  try { const { data } = await saleService.returnSale(id); return data.data; }
  catch (error) { return rejectWithValue(error.response?.data?.message || 'Failed to return sale'); }
});

export const fetchSaleStats = createAsyncThunk('sales/fetchStats', async (_, { rejectWithValue }) => {
  try { const { data } = await saleService.getSaleStats(); return data.data; }
  catch (error) { return rejectWithValue(error.response?.data?.message || 'Failed to fetch stats'); }
});

const saleSlice = createSlice({
  name: 'sales',
  initialState: { items: [], total: 0, loading: false, error: null, selectedSale: null, stats: null },
  reducers: {
    clearError: (state) => { state.error = null; },
    clearSelectedSale: (state) => { state.selectedSale = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSales.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchSales.fulfilled, (state, action) => { state.loading = false; state.items = action.payload.data; state.total = action.payload.pagination?.total || 0; })
      .addCase(fetchSales.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchSale.pending, (state) => { state.loading = true; })
      .addCase(fetchSale.fulfilled, (state, action) => { state.loading = false; state.selectedSale = action.payload; })
      .addCase(fetchSale.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(createSale.fulfilled, (state, action) => { state.items.unshift(action.payload); state.total += 1; })
      .addCase(deleteSale.fulfilled, (state, action) => { state.items = state.items.filter((i) => i._id !== action.payload); state.total -= 1; })
      .addCase(returnSale.fulfilled, (state, action) => {
        const idx = state.items.findIndex((i) => i._id === action.payload._id);
        if (idx !== -1) state.items[idx] = action.payload;
        if (state.selectedSale?._id === action.payload._id) state.selectedSale = action.payload;
      })
      .addCase(fetchSaleStats.fulfilled, (state, action) => { state.stats = action.payload; });
  },
});

export const { clearError, clearSelectedSale } = saleSlice.actions;
export default saleSlice.reducer;