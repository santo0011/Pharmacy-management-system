import Swal from 'sweetalert2';

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

export const showSuccess = (message) => {
  return Toast.fire({
    icon: 'success',
    title: message,
    background: '#1f2937',
    color: '#fff',
    iconColor: '#22c55e',
  });
};

export const showError = (message) => {
  return Toast.fire({
    icon: 'error',
    title: message,
    background: '#1f2937',
    color: '#fff',
    iconColor: '#ef4444',
  });
};

export const showWarning = (message) => {
  return Toast.fire({
    icon: 'warning',
    title: message,
    background: '#1f2937',
    color: '#fff',
    iconColor: '#f59e0b',
  });
};

export const showInfo = (message) => {
  return Toast.fire({
    icon: 'info',
    title: message,
    background: '#1f2937',
    color: '#fff',
    iconColor: '#0ea5e9',
  });
};

export const confirmDelete = async (itemName = 'this item') => {
  const result = await Swal.fire({
    title: 'Are you sure?',
    text: `You won't be able to revert this!`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Yes, delete it!',
    cancelButtonText: 'Cancel',
    background: '#1f2937',
    color: '#fff',
    iconColor: '#f59e0b',
    reverseButtons: true,
  });
  return result.isConfirmed;
};

export const confirmAction = async (title, text, confirmText = 'Confirm') => {
  const result = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    cancelButtonColor: '#64748b',
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancel',
    background: '#1f2937',
    color: '#fff',
    iconColor: '#f59e0b',
    reverseButtons: true,
  });
  return result.isConfirmed;
};

export const showLoading = (title = 'Please wait...') => {
  return Swal.fire({
    title,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
    background: '#1f2937',
    color: '#fff',
  });
};

export const closeLoading = () => {
  Swal.close();
};