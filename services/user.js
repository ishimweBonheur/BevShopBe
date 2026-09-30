const { get } = require('mongoose');

const User = require('../models/User');

const createUser = async (userData) => {
  const user = new User(userData);
  await user.save();
  return user;
};

const updateUser = async (userId, updatedData) => {
  return await User.findByIdAndUpdate(userId, updatedData, { new: true });
};


// this is to inactivate the user instead of deleting him or her 
const deleteUser = async (userId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { is_active: false },
    { new: true } 
  );

  if (!user) {
    throw new Error('User not found');
  }

  return user;
}


const disableUser = async (id) => {
  const user = await User.findById(id);
  if (!user) {
    throw new Error('user not found');
  }

  user.is_active = !user.is_active;
  return await user.save();
};



// This is to retrieve all users  and exclude his password 
const getAllUsers = async () => {
  return await User.find().select('-password'); 
};
module.exports = { createUser, updateUser, deleteUser,getAllUsers, disableUser };
