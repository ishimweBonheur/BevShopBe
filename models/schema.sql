CREATE SCHEMA IF NOT EXISTS bevshop;
SET search_path TO bevshop, public;
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, email text UNIQUE NOT NULL, username text UNIQUE NOT NULL,
 password text NOT NULL, first_name text NOT NULL, last_name text NOT NULL,
 phone text NOT NULL DEFAULT '', role text NOT NULL CHECK(role IN ('ADMIN','MANAGER','CASHIER')),
 is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (
 id integer PRIMARY KEY CHECK(id=1), currency text NOT NULL DEFAULT '',
 timezone text NOT NULL DEFAULT 'UTC', target_margin numeric(6,3) NOT NULL DEFAULT 20 CHECK(target_margin>=0 AND target_margin<100)
);
INSERT INTO settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS categories (
 id uuid PRIMARY KEY, name text UNIQUE NOT NULL, description text NOT NULL DEFAULT '', is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS products (
 id uuid PRIMARY KEY, name text NOT NULL, category_id uuid REFERENCES categories(id),
 description text NOT NULL DEFAULT '', barcode text UNIQUE NOT NULL,
 units_per_pack integer NOT NULL CHECK(units_per_pack>0), selling_price numeric(24,6) NOT NULL CHECK(selling_price>=0),
 quantity integer NOT NULL DEFAULT 0 CHECK(quantity>=0), inventory_value numeric(24,6) NOT NULL DEFAULT 0 CHECK(inventory_value>=0),
 low_stock_level integer NOT NULL DEFAULT 12 CHECK(low_stock_level>=0),
 is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(quantity>0 OR inventory_value=0)
);
CREATE TABLE IF NOT EXISTS transactions (
 id uuid PRIMARY KEY, request_key uuid UNIQUE NOT NULL, kind text NOT NULL CHECK(kind IN ('purchase','sale','expense','loss','reversal','capital','withdrawal')),
 amount numeric(24,6) NOT NULL CHECK(amount>=0), payment_method text NOT NULL CHECK(payment_method IN ('cash','mobile_money','bank')),
 category text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), reversal_of uuid UNIQUE REFERENCES transactions(id)
);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS request_hash text NOT NULL DEFAULT '';
ALTER TABLE transactions ALTER COLUMN created_at SET DEFAULT clock_timestamp();
CREATE TABLE IF NOT EXISTS transaction_items (
 id uuid PRIMARY KEY, transaction_id uuid NOT NULL REFERENCES transactions(id), product_id uuid NOT NULL REFERENCES products(id),
 product_name text NOT NULL, quantity integer NOT NULL CHECK(quantity>0),
 unit_price numeric(24,6) NOT NULL CHECK(unit_price>=0), cost numeric(24,6) NOT NULL CHECK(cost>=0),
 packs integer, units_per_pack integer, UNIQUE(transaction_id,product_id)
);
CREATE TABLE IF NOT EXISTS stock_movements (
 id uuid PRIMARY KEY, transaction_id uuid NOT NULL REFERENCES transactions(id), product_id uuid NOT NULL REFERENCES products(id),
 quantity_delta integer NOT NULL CHECK(quantity_delta<>0), value_delta numeric(24,6) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS journal_lines (
 id uuid PRIMARY KEY, transaction_id uuid NOT NULL REFERENCES transactions(id),
 account text NOT NULL CHECK(account IN ('cash','mobile_money','bank','inventory','sales','cost_of_sales','operating_expenses','stock_losses','owner_equity','owner_drawings')),
 debit numeric(24,6) NOT NULL DEFAULT 0 CHECK(debit>=0), credit numeric(24,6) NOT NULL DEFAULT 0 CHECK(credit>=0),
 CHECK(debit=0 OR credit=0)
);
CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(created_at);
CREATE INDEX IF NOT EXISTS journal_transaction_idx ON journal_lines(transaction_id);
CREATE INDEX IF NOT EXISTS movements_product_idx ON stock_movements(product_id);
CREATE OR REPLACE FUNCTION check_balanced_journal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM journal_lines WHERE transaction_id=NEW.id)
 OR (SELECT sum(debit-credit) FROM journal_lines WHERE transaction_id=NEW.id) <> 0 THEN
  RAISE EXCEPTION 'Transaction requires a balanced journal';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS balanced_journal ON transactions;
CREATE CONSTRAINT TRIGGER balanced_journal AFTER INSERT ON transactions DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION check_balanced_journal();
CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit entries are immutable; post a reversal instead'; END $$;
DROP TRIGGER IF EXISTS immutable_journal ON journal_lines;
CREATE TRIGGER immutable_journal BEFORE UPDATE OR DELETE ON journal_lines FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
DROP TRIGGER IF EXISTS immutable_stock ON stock_movements;
CREATE TRIGGER immutable_stock BEFORE UPDATE OR DELETE ON stock_movements FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
DROP TRIGGER IF EXISTS immutable_items ON transaction_items;
CREATE TRIGGER immutable_items BEFORE UPDATE OR DELETE ON transaction_items FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
ALTER TABLE settings ALTER COLUMN currency SET DEFAULT 'RWF';
ALTER TABLE settings ALTER COLUMN timezone SET DEFAULT 'Africa/Kigali';
UPDATE settings SET currency='RWF',timezone='Africa/Kigali' WHERE currency IN ('','RWF');
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_currency_check;
ALTER TABLE settings ADD CONSTRAINT settings_currency_check CHECK(currency='RWF');
CREATE UNIQUE INDEX IF NOT EXISTS categories_normalized_name ON categories(lower(trim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS products_normalized_name ON products(lower(trim(name)));
CREATE TABLE IF NOT EXISTS suppliers (
 id uuid PRIMARY KEY, name text NOT NULL, phone text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', address text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_normalized_name ON suppliers(lower(trim(name)));
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id);
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS category_name text NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS creation_key uuid UNIQUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS creation_hash text NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id);
UPDATE settings SET owner_id=(SELECT id FROM users ORDER BY created_at,id LIMIT 1) WHERE owner_id IS NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_purchase_cost numeric(24,6) NOT NULL DEFAULT 0 CHECK(last_purchase_cost>=0);
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS recovery_codes (
 hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_kind_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_kind_check CHECK(kind IN ('purchase','sale','expense','loss','reversal','capital','withdrawal','stock_count'));
ALTER TABLE journal_lines DROP CONSTRAINT IF EXISTS journal_lines_account_check;
ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_account_check CHECK(account IN ('cash','mobile_money','bank','inventory','sales','cost_of_sales','operating_expenses','stock_losses','stock_gains','owner_equity','owner_drawings'));
CREATE TABLE IF NOT EXISTS stock_counts (
 id uuid PRIMARY KEY, transaction_id uuid UNIQUE NOT NULL REFERENCES transactions(id), product_id uuid NOT NULL REFERENCES products(id),
 expected_quantity integer NOT NULL, actual_quantity integer NOT NULL CHECK(actual_quantity>=0),
 unit_cost numeric(24,6) NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS cash_reconciliations (
 id uuid PRIMARY KEY, request_key uuid UNIQUE NOT NULL, request_hash text NOT NULL,
 business_date date NOT NULL, cutoff timestamptz NOT NULL, expected_cash numeric(24,6) NOT NULL,
 actual_cash numeric(24,6) NOT NULL CHECK(actual_cash>=0), expected_mobile numeric(24,6) NOT NULL,
 actual_mobile numeric(24,6) NOT NULL CHECK(actual_mobile>=0), notes text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
DROP TRIGGER IF EXISTS immutable_counts ON stock_counts;
CREATE TRIGGER immutable_counts BEFORE UPDATE OR DELETE ON stock_counts FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
DROP TRIGGER IF EXISTS immutable_reconciliations ON cash_reconciliations;
CREATE TRIGGER immutable_reconciliations BEFORE UPDATE OR DELETE ON cash_reconciliations FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
