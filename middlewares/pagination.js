const pagination = (model) => {
  return async (req, res, next) => {
    const { page = 1, limit = 10, search = '', role } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) {
      filter.role = role;
    }

    try {
      const list = await model.find(filter)
        .skip((page - 1) * limit)
        .select('-password')
        .limit(parseInt(limit));

      const total = await model.countDocuments(filter);
      const totalPages = Math.ceil(total / limit);

      res.pagination = {
        list,
        total,
        totalPages,
        currentPage: parseInt(page),
        nextPage: page < totalPages ? parseInt(page) + 1 : null,
        prevPage: page > 1 ? parseInt(page) - 1 : null,
      };

      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
};

module.exports = pagination;