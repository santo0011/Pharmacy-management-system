import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { medicineService } from '../../services/medicineService';

export const fetchMedicines = createAsyncThunk(
  'medicines/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await medicineService.getMedicines(params);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch medicines');
    }
  }
);

export const fetchMedicineStats = createAsyncThunk(
  'medicines/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await medicineService.getMedicineStats();
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch medicine stats');
    }
  }
);

export const fetchMedicine = createAsyncThunk(
  'medicines/fetchOne',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await medicineService.getMedicine(id);
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch medicine');
    }
  }
);

export const createMedicine = createAsyncThunk(
  'medicines/create',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await medicineService.createMedicine(formData);
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create medicine');
    }
  }
);

export const updateMedicine = createAsyncThunk(
  'medicines/update',
  async ({ id, formData }, { rejectWithValue }) => {
    try {
      const { data } = await medicineService.updateMedicine(id, formData);
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update medicine');
    }
  }
);

export const deleteMedicine = createAsyncThunk(
  'medicines/delete',
  async (id, { rejectWithValue }) => {
    try {
      await medicineService.deleteMedicine(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete medicine');
    }
  }
);

export const toggleMedicineStatus = createAsyncThunk(
  'medicines/toggleStatus',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await medicineService.toggleStatus(id);
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle status');
    }
  }
);

const medicineSlice = createSlice({
  name: 'medicines',
  initialState: {
    items: [],
    total: 0,
    loading: false,
    error: null,
    selectedMedicine: null,
    stats: {
      totalMedicines: 0,
      activeMedicines: 0,
      lowStockMedicines: 0,
      expiredMedicines: 0,
      nearExpiryMedicines: 0,
    },
    statsLoading: false,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSelectedMedicine: (state) => {
      state.selectedMedicine = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch list
      .addCase(fetchMedicines.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMedicines.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.data;
        state.total = action.payload.pagination?.total || 0;
      })
      .addCase(fetchMedicines.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch stats
      .addCase(fetchMedicineStats.pending, (state) => {
        state.statsLoading = true;
      })
      .addCase(fetchMedicineStats.fulfilled, (state, action) => {
        state.statsLoading = false;
        state.stats = action.payload;
      })
      .addCase(fetchMedicineStats.rejected, (state, action) => {
        state.statsLoading = false;
        state.error = action.payload;
      })
      // Fetch single
      .addCase(fetchMedicine.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMedicine.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedMedicine = action.payload;
      })
      .addCase(fetchMedicine.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Create
      .addCase(createMedicine.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
        state.total += 1;
      })
      // Update
      .addCase(updateMedicine.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        if (state.selectedMedicine?._id === action.payload._id) {
          state.selectedMedicine = action.payload;
        }
      })
      // Delete
      .addCase(deleteMedicine.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item._id !== action.payload);
        state.total -= 1;
      })
      // Toggle status
      .addCase(toggleMedicineStatus.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      });
  },
});

export const { clearError, clearSelectedMedicine } = medicineSlice.actions;
export default medicineSlice.reducer;