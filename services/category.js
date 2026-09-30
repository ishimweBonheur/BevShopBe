const Category = require('../models/Category');

const getCategories = async () => {
  return await Category.find({isActive:true}).populate('parent');
};

const createCategory = async (categoryData) => {
  const newCategory = new Category(categoryData);
  return await newCategory.save();
};

const updateCategory = async (id, categoryData) => {
  const category = await Category.findById(id);
  if (!category) {
    throw new Error('Category not found');
  }

  Object.assign(category, categoryData);
  return await category.save();
};

const deleteCategory = async (id) => {
  const category = await Category.findById(id);
  if (!category) {
    throw new Error('Category not found');
  }

  return await category.remove();
};

const disableCategory = async (id) => {
  const category = await Category.findById(id);
  if (!category) {
    throw new Error('Category not found');
  }

  category.isActive = !category.isActive;
  return await category.save();
};


const activateAllCategories = async () => {
  try {
   
    const updateResult = await Category.updateMany(
      { isActive: { $exists: false } }, 
      { $set: { isActive: true } }      
    );
    return updateResult;
  } catch (error) {
    console.log(error)
    throw new Error('Error activating all categories');
  }
};


module.exports = { getCategories, createCategory, updateCategory, deleteCategory, disableCategory,activateAllCategories };