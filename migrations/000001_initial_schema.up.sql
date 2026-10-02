CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX categories_unique_name ON categories (LOWER(TRIM(name)));

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT,
    units_per_pack INTEGER NOT NULL CHECK (units_per_pack > 0),
    selling_price NUMERIC(14, 2) NOT NULL CHECK (selling_price >= 0),
    average_cost_per_item NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (average_cost_per_item >= 0),
    current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    low_stock_level INTEGER NOT NULL DEFAULT 0 CHECK (low_stock_level >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX products_unique_name ON products (LOWER(TRIM(name)));

CREATE INDEX products_category_idx ON products(category_id);

CREATE INDEX products_active_idx ON products(is_active);

CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX suppliers_unique_name ON suppliers (LOWER(TRIM(name)));

CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE
    SET
        NULL,
        purchase_date TIMESTAMPTZ NOT NULL DEFAULT now(),
        total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX purchases_date_idx ON purchases(purchase_date);

CREATE INDEX purchases_supplier_idx ON purchases(supplier_id);

CREATE TABLE purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    packs INTEGER NOT NULL CHECK (packs > 0),
    units_per_pack INTEGER NOT NULL CHECK (units_per_pack > 0),
    total_items INTEGER NOT NULL CHECK (total_items > 0),
    price_per_pack NUMERIC(14, 2) NOT NULL CHECK (price_per_pack >= 0),
    price_per_item NUMERIC(14, 2) NOT NULL CHECK (price_per_item >= 0),
    total_cost NUMERIC(14, 2) NOT NULL CHECK (total_cost >= 0)
);

CREATE INDEX purchase_items_purchase_idx ON purchase_items(purchase_id);

CREATE INDEX purchase_items_product_idx ON purchase_items(product_id);

CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    payment_method TEXT NOT NULL CHECK (
        payment_method IN ('cash', 'mobile_money', 'bank')
    ),
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sales_date_idx ON sales(sale_date);

CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    selling_price_per_item NUMERIC(14, 2) NOT NULL CHECK (selling_price_per_item >= 0),
    cost_price_per_item NUMERIC(14, 2) NOT NULL CHECK (cost_price_per_item >= 0),
    line_total NUMERIC(14, 2) NOT NULL CHECK (line_total >= 0),
    line_cost NUMERIC(14, 2) NOT NULL CHECK (line_cost >= 0)
);

CREATE INDEX sale_items_sale_idx ON sale_items(sale_id);

CREATE INDEX sale_items_product_idx ON sale_items(product_id);

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT,
    description TEXT,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    expense_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX expenses_date_idx ON expenses(expense_date);

CREATE TABLE damaged_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reason TEXT,
    cost_per_item NUMERIC(14, 2) NOT NULL CHECK (cost_per_item >= 0),
    total_loss NUMERIC(14, 2) NOT NULL CHECK (total_loss >= 0),
    damaged_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX damaged_items_product_idx ON damaged_items(product_id);

CREATE INDEX damaged_items_date_idx ON damaged_items(damaged_date);

CREATE TABLE owner_money (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_type TEXT NOT NULL CHECK (entry_type IN ('money_added', 'money_taken')),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    notes TEXT,
    entry_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX owner_money_date_idx ON owner_money(entry_date);