import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { settingService } from '../../services/settingService';
import { setPlatformCurrencySymbol, getCurrencySymbol } from '../../utils/currency';

export const fetchSettings = createAsyncThunk(
  'settings/fetchSettings',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await settingService.getSettings();
      return data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch settings');
    }
  }
);

const initialState = {
  settings: [],
  loading: false,
  error: null,
  currencySymbol: '₹',
};

const settingSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    clearSettingsError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.settings = action.payload;
        
        // Find currency setting and update the cached symbol
        const currencySetting = action.payload?.find(s => s.key === 'currency');
        if (currencySetting) {
          const symbol = getCurrencySymbol(currencySetting.value);
          state.currencySymbol = symbol;
          setPlatformCurrencySymbol(symbol);
        }
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearSettingsError } = settingSlice.actions;
export default settingSlice.reducer;