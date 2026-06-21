import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { brandService } from '../../services/brandService';

export const fetchBrands = createAsyncThunk(
  'brands/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await brandService.getAll(params);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch brands');
    }
  }
);

export const createBrand = createAsyncThunk(
  'brands/create',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await brandService.create(formData);
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create brand');
    }
  }
);

export const updateBrand = createAsyncThunk(
  'brands/update',
  async ({ id, formData }, { rejectWithValue }) => {
    try {
      const { data } = await brandService.update(id, formData);
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update brand');
    }
  }
);

export const deleteBrand = createAsyncThunk(
  'brands/delete',
  async (id, { rejectWithValue }) => {
    try {
      await brandService.delete(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete brand');
    }
  }
);

export const toggleBrandStatus = createAsyncThunk(
  'brands/toggleStatus',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await brandService.toggleStatus(id);
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle status');
    }
  }
);

const brandSlice = createSlice({
  name: 'brands',
  initialState: {
    items: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBrands.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBrands.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.data;
        state.total = action.payload.pagination?.total || 0;
        state.page = action.payload.pagination?.page || 1;
        state.limit = action.payload.pagination?.limit || 10;
        state.totalPages = action.payload.pagination?.totalPages || 1;
      })
      .addCase(fetchBrands.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createBrand.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
        state.total += 1;
      })
      .addCase(updateBrand.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item._id === action.payload._id);
        if (index !== -1) state.items[index] = action.payload;
      })
      .addCase(deleteBrand.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item._id !== action.payload);
        state.total -= 1;
      })
      .addCase(toggleBrandStatus.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item._id === action.payload._id);
        if (index !== -1) state.items[index] = action.payload;
      });
  },
});

export default brandSlice.reducer;