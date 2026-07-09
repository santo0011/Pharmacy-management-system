import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { subscriptionPlanService } from '../../services/subscriptionPlanService';

export const fetchPlans = createAsyncThunk(
  'subscriptionPlans/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await subscriptionPlanService.getPlans(params);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch plans');
    }
  }
);

export const fetchActivePlans = createAsyncThunk(
  'subscriptionPlans/fetchActive',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await subscriptionPlanService.getActivePlans();
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch active plans');
    }
  }
);

export const createPlan = createAsyncThunk(
  'subscriptionPlans/create',
  async (planData, { rejectWithValue }) => {
    try {
      const { data } = await subscriptionPlanService.createPlan(planData);
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create plan');
    }
  }
);

export const updatePlan = createAsyncThunk(
  'subscriptionPlans/update',
  async ({ id, ...planData }, { rejectWithValue }) => {
    try {
      const { data } = await subscriptionPlanService.updatePlan(id, planData);
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update plan');
    }
  }
);

export const togglePlanStatus = createAsyncThunk(
  'subscriptionPlans/toggleStatus',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await subscriptionPlanService.toggleStatus(id);
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle plan status');
    }
  }
);

export const deletePlan = createAsyncThunk(
  'subscriptionPlans/delete',
  async (id, { rejectWithValue }) => {
    try {
      await subscriptionPlanService.deletePlan(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete plan');
    }
  }
);

const subscriptionPlanSlice = createSlice({
  name: 'subscriptionPlans',
  initialState: {
    items: [],
    activePlans: [],
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
      .addCase(fetchPlans.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPlans.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.data;
        state.total = action.payload.pagination?.total || 0;
      })
      .addCase(fetchPlans.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchActivePlans.fulfilled, (state, action) => {
        state.activePlans = action.payload.data || [];
      })
      .addCase(createPlan.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
        state.total += 1;
      })
      .addCase(updatePlan.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        const activeIndex = state.activePlans.findIndex((item) => item._id === action.payload._id);
        if (activeIndex !== -1) {
          if (action.payload.isActive) {
            state.activePlans[activeIndex] = action.payload;
          } else {
            state.activePlans = state.activePlans.filter((item) => item._id !== action.payload._id);
          }
        }
      })
      .addCase(togglePlanStatus.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        if (action.payload.isActive) {
          if (!state.activePlans.find((p) => p._id === action.payload._id)) {
            state.activePlans.push(action.payload);
          }
        } else {
          state.activePlans = state.activePlans.filter((p) => p._id !== action.payload._id);
        }
      })
      .addCase(deletePlan.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item._id !== action.payload);
        state.total -= 1;
        state.activePlans = state.activePlans.filter((p) => p._id !== action.payload);
      });
  },
});

export const { clearError } = subscriptionPlanSlice.actions;
export default subscriptionPlanSlice.reducer;