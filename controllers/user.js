const userService = require('../services/user');
const createUser = async (req, res) => {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body);

    if (!user) {
      return res.status(404).json({ error: "User not found. Please check the provided user ID." });
    }

    res.status(200).json(user);
  } catch (error) {
    if (error.code === 11000) {
      // Handle duplicate key error
      const duplicateField = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        error: `A user with this ${duplicateField} already exists: ${error.keyValue[duplicateField]}. Please use a different ${duplicateField}.`
      });
    }

    if (error.name === "ValidationError") {
    
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: `Validation failed: ${validationErrors.join(", ")}` });
    }

    if (error.name === "CastError" && error.kind === "ObjectId") {
      
      return res.status(400).json({ error: "Invalid user ID format." });
    }

    
    res.status(500).json({ error: `Server error: ${error.message}` });
  }
};



// this is the controller  to deactivate the user 
const deleteUser = async (req, res) => {
  try {
    const updatedUser = await userService.deleteUser(req.params.id);
    res.status(200).json({ message: 'User deactivated', user: updatedUser });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


const getAllUsers = async (req, res) => {
  try {
    const activeUsers = res.pagination.list.filter(user => user.is_active);

    res.status(200).json({
      ...res.pagination,
      list: activeUsers,
      total: activeUsers.length,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


 const activeUser = async (req,res) =>{
    try {
      const user = await userService.disableUser(req.params.id);
      const message = user.is_active === true ? "User activated successfully" : " User disactivated successfully"
      res.json({message,user});
    } catch (error) {
      if (error.message === 'User not found') {
        return res.status(404).json({ error: 'User not found' });
      } else {
        return res.status(500).json({ error: 'Failed to disable User' });
      }
    }
  }
module.exports = { createUser, updateUser, deleteUser,getAllUsers,activeUser };
