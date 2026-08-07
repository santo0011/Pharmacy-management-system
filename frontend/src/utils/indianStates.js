/**
 * Centralized Indian States & Union Territories list
 * Used across the entire application for GST calculations and customer forms.
 * Single source of truth - do NOT create state lists elsewhere.
 */

export const INDIAN_STATES = [
  { name: 'Andhra Pradesh', code: '28', id: 'AP' },
  { name: 'Arunachal Pradesh', code: '12', id: 'AR' },
  { name: 'Assam', code: '18', id: 'AS' },
  { name: 'Bihar', code: '10', id: 'BR' },
  { name: 'Chhattisgarh', code: '22', id: 'CG' },
  { name: 'Goa', code: '30', id: 'GA' },
  { name: 'Gujarat', code: '24', id: 'GJ' },
  { name: 'Haryana', code: '06', id: 'HR' },
  { name: 'Himachal Pradesh', code: '02', id: 'HP' },
  { name: 'Jharkhand', code: '20', id: 'JH' },
  { name: 'Karnataka', code: '29', id: 'KA' },
  { name: 'Kerala', code: '32', id: 'KL' },
  { name: 'Madhya Pradesh', code: '23', id: 'MP' },
  { name: 'Maharashtra', code: '27', id: 'MH' },
  { name: 'Manipur', code: '14', id: 'MN' },
  { name: 'Meghalaya', code: '17', id: 'ML' },
  { name: 'Mizoram', code: '15', id: 'MZ' },
  { name: 'Nagaland', code: '13', id: 'NL' },
  { name: 'Odisha', code: '21', id: 'OD' },
  { name: 'Punjab', code: '03', id: 'PB' },
  { name: 'Rajasthan', code: '08', id: 'RJ' },
  { name: 'Sikkim', code: '11', id: 'SK' },
  { name: 'Tamil Nadu', code: '33', id: 'TN' },
  { name: 'Telangana', code: '36', id: 'TG' },
  { name: 'Tripura', code: '16', id: 'TR' },
  { name: 'Uttar Pradesh', code: '09', id: 'UP' },
  { name: 'Uttarakhand', code: '05', id: 'UK' },
  { name: 'West Bengal', code: '19', id: 'WB' },
  // Union Territories
  { name: 'Delhi', code: '07', id: 'DL' },
  { name: 'Jammu & Kashmir', code: '01', id: 'JK' },
  { name: 'Ladakh', code: '38', id: 'LA' },
  { name: 'Chandigarh', code: '04', id: 'CH' },
  { name: 'Puducherry', code: '34', id: 'PY' },
  { name: 'Andaman & Nicobar Islands', code: '35', id: 'AN' },
  { name: 'Lakshadweep', code: '31', id: 'LD' },
  { name: 'Dadra & Nagar Haveli and Daman & Diu', code: '26', id: 'DD' },
];

// Get state code by state name
export const getStateCodeByName = (stateName) => {
  if (!stateName) return '';
  const clean = stateName.trim().toLowerCase();
  const state = INDIAN_STATES.find(s => s.name.toLowerCase() === clean);
  return state?.code || '';
};

// Get state name by state code
export const getStateNameByCode = (stateCode) => {
  if (!stateCode) return '';
  const state = INDIAN_STATES.find(s => s.code === String(stateCode).padStart(2, '0'));
  return state?.name || '';
};

// Get full state object by code
export const getStateByCode = (stateCode) => {
  if (!stateCode) return null;
  return INDIAN_STATES.find(s => s.code === String(stateCode).padStart(2, '0')) || null;
};

export default INDIAN_STATES;