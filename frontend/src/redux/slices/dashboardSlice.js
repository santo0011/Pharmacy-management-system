import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { dashboardService } from '../../services/dashboardService';

export const fetchSuperAdminDashboard = createAsyncThunk(
  'dashboard/fetchSuperAdmin',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await dashboardService.getSuperAdminDashboard();
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard data');
    }
  }
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    superAdmin: null,
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
      .addCase(fetchSuperAdminDashboard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSuperAdminDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.superAdmin = action.payload;
      })
      .addCase(fetchSuperAdminDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError } = dashboardSlice.actions;
export default dashboardSlice.reducer;