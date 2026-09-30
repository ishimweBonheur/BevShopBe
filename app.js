const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const reportRouter = require("./routes/reports");
const { swaggerUi, specs } = require("./swagger");
const userRoutes = require("./routes/user");
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const categoryRoutes = require("./routes/categories");
const sales = require("./routes/sales");
const stockMovementRoutes = require("./routes/stockMovement");
const salesOrderRoutes = require("./routes/salesOrder");
const barcodeRoutes = require("./routes/barcode");
const exchangeRateRoutes = require("./routes/exchangeRate");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Root route - so GET / returns 200 (avoids 404 on base URL)
app.get("/", (req, res) => {
  res.json({
    message: "Demostock API is running",
    docs: "/api/docs",
    health: "ok",
  });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"), {
    serverSelectionTimeoutMS: 5000,
  })
  .catch((err) => console.error("MongoDB connection error:", err));

app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/stock-movements", stockMovementRoutes);
app.use("/api/reports", reportRouter);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/salesOrders", salesOrderRoutes);
app.use("/api/sales", sales);
// Swagger: use request host + correct protocol (Vercel uses x-forwarded-proto for https)
app.use("/api/docs", (req, res, next) => {
  const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
  const host = req.get("host") || req.get("x-forwarded-host");
  req.swaggerDoc = {
    ...specs,
    servers: [{ url: `${protocol}://${host}` }],
  };
  next();
}, swaggerUi.serve, swaggerUi.setup(specs, {
  customCssUrl: "https://cdn.jsdelivr.net/npm/swagger-ui-dist@4.18.3/swagger-ui.css",
  customSiteTitle: "Demostock API",
}));
app.use('/api/exchange-rate', exchangeRateRoutes);

const port = process.env.PORT || 2000;
app.listen(port, () => console.log(`Server listening on port ${port}`));
