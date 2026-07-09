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

export const fetchPharmacyDashboard = createAsyncThunk(
  'dashboard/fetchPharmacy',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await dashboardService.getPharmacyDashboard();
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard data');
    }
  }
);

export const fetchSubscriptionStatus = createAsyncThunk(
  'dashboard/fetchSubscriptionStatus',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await dashboardService.getSubscriptionStatus();
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch subscription status');
    }
  }
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    superAdmin: null,
    pharmacy: null,
    subscriptionStatus: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSubscriptionStatus: (state) => {
      state.subscriptionStatus = null;
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
      })
      .addCase(fetchPharmacyDashboard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPharmacyDashboard.fulfilled, (state, action) => {
        state.loading = false;
        state.pharmacy = action.payload;
      })
      .addCase(fetchPharmacyDashboard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchSubscriptionStatus.fulfilled, (state, action) => {
        state.subscriptionStatus = action.payload;
      });
  },
});

export const { clearError, clearSubscriptionStatus } = dashboardSlice.actions;
export default dashboardSlice.reducer;