-- Older installations applied version 1 with last_purchase_price_per_item.
-- Preserve its values as the starting inventory cost. Fresh installations
-- already have average_cost_per_item and need no change.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'products'
          AND column_name = 'average_cost_per_item'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'products'
              AND column_name = 'last_purchase_price_per_item'
        ) THEN
            ALTER TABLE public.products
                RENAME COLUMN last_purchase_price_per_item TO average_cost_per_item;
        ELSE
            RAISE EXCEPTION 'products has neither average_cost_per_item nor last_purchase_price_per_item; inspect the schema before migrating';
        END IF;
    END IF;
END $$;
