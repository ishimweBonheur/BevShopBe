const Category = require('../models/Category');
const categoryService = require('../services/category');

exports.getCategories = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, search = "" } = req.query;

    const currentPage = parseInt(page, 10) || 1;
    const size = parseInt(pageSize, 10) || 10;

    if (currentPage < 1 || pageSize < 1) {
      return res.status(400).json({ error: "Invalid page or size value" });
    }

    // Create the search query if the 'search' parameter is provided
    const searchQuery = search ? { name: { $regex: search, $options: "i" } } : {};

    const total = await Category.countDocuments(searchQuery);
    const totalPages = Math.ceil(total / size);
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    const categories = await Category.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * size)
      .limit(size)
      .lean();

    res.status(200).json({
      list: categories,
      total,
      totalPages,
      currentPage,
      pageSize,
      nextPage: hasNextPage ? currentPage + 1 : null,
      prevPage: hasPrevPage ? currentPage - 1 : null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};





exports.createCategory = async (req, res) => {
  try {
    const category = await categoryService.createCategory(req.body);
    res.status(201).json(category);
  } catch (error) {
    console.log(error)
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    } else {
      return res.status(500).json({ error: 'Failed to create category' });
    }
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await categoryService.updateCategory(req.params.id, req.body);
    res.json(category);
  } catch (error) {
    if (error.message === 'Category not found') {
      return res.status(404).json({ error: 'Category not found' });
    } else {
      return res.status(500).json({ error: 'Failed to update category' });
    }
  }
};

// This is to deactivate the category
exports.deactivateCategory = async (req, res) => {
  try {
    await categoryService.disableCategory(req.params.id);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    if (error.message === 'Category not found') {
      return res.status(404).json({ error: 'Category not found' });
    } else {
      return res.status(500).json({ error: 'Failed to delete category' });
    }
  }
};

// This is to delete the category
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) return res.status(404).json({ error: "Category not found" });

    res.json({
      message: "Category successfully deleted",
      category,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.activateAllCategories = async (req, res) => {
  try {
    const categories = await categoryService.activateAllCategories();
    res.json({ message: 'All categories activated successfully', categories });
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Failed to activate all categories' });
  }
};


exports.disableCategory = async (req,res) =>{
  try {
    const category = await categoryService.disableCategory(req.params.id);
    const message = category.isActive === true ? "category enabled" : " category disabled"
    res.json({message,category});
  } catch (error) {
    if (error.message === 'Category not found') {
      return res.status(404).json({ error: 'Category not found' });
    } else {
      return res.status(500).json({ error: 'Failed to disable category' });
    }
  }
}