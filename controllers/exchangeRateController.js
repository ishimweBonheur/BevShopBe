const ExchangeRate = require('../models/ExchangeRate');

// This is to get the current exchange rate
exports.getExchangeRate = async (req, res) => {
  try {
    const latestRate = await ExchangeRate.findOne().sort({ updatedAt: -1 });
    if (!latestRate) {
      // A fresh installation has no rate yet. Treat that as an empty setting,
      // rather than a missing endpoint, so clients can render their empty state.
      return res.status(200).json({ rate: null });
    }
    res.status(200).json({ rate: latestRate.rate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// This is to update the exchange rate (Admin only)
exports.updateExchangeRate = async (req, res) => {
  try {
    const { rate } = req.body;
    const updatedBy = req.user.id; 

    if (!rate || isNaN(rate)) {
      return res.status(400).json({ message: 'Invalid rate provided' });
    }

    const newExchangeRate = new ExchangeRate({ rate, updatedBy });
    await newExchangeRate.save();

    res.status(200).json({ message: 'Exchange rate updated successfully', rate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
