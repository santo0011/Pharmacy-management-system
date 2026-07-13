import User from '../models/User.js';

const seedSuperAdmin = async () => {
  try {
    const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
    if (!existingSuperAdmin) {
      await User.create({
        name: 'Super Admin',
        email: 'admin@pharmacy.com',
        password: '123456',
        role: 'super_admin',
        phone: '0000000000',
        isActive: true,
      });
      console.log('Default Super Admin created successfully');
      console.log('Email: admin@pharmacy.com');
      console.log('Password: 123456');
    } else {
      console.log('Super Admin already exists');
    }
  } catch (error) {
    console.error('Error seeding super admin:', error.message);
  }
};

export default seedSuperAdmin;