import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { pharmacyService } from '../../services/pharmacyService';

export const fetchPharmacies = createAsyncThunk(
  'pharmacies/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await pharmacyService.getPharmacies(params);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch pharmacies');
    }
  }
);

export const createPharmacy = createAsyncThunk(
  'pharmacies/create',
  async (pharmacyData, { rejectWithValue }) => {
    try {
      const { data } = await pharmacyService.createPharmacy(pharmacyData);
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create pharmacy');
    }
  }
);

export const updatePharmacy = createAsyncThunk(
  'pharmacies/update',
  async ({ id, ...pharmacyData }, { rejectWithValue }) => {
    try {
      const { data } = await pharmacyService.updatePharmacy(id, pharmacyData);
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update pharmacy');
    }
  }
);

export const deletePharmacy = createAsyncThunk(
  'pharmacies/delete',
  async (id, { rejectWithValue }) => {
    try {
      await pharmacyService.deletePharmacy(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete pharmacy');
    }
  }
);

const pharmacySlice = createSlice({
  name: 'pharmacies',
  initialState: {
    items: [],
    total: 0,
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPharmacies.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPharmacies.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.data;
        state.total = action.payload.pagination?.total || 0;
      })
      .addCase(fetchPharmacies.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createPharmacy.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
        state.total += 1;
      })
      .addCase(updatePharmacy.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(deletePharmacy.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item._id !== action.payload);
        state.total -= 1;
      });
  },
});

export const { clearError } = pharmacySlice.actions;
export default pharmacySlice.reducer;