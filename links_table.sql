-- Create links table for stock research links
CREATE TABLE IF NOT EXISTS links (
    id SERIAL PRIMARY KEY,
    link TEXT NOT NULL,
    date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    stock_valuations_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_stock_valuations 
        FOREIGN KEY (stock_valuations_id) 
        REFERENCES stock_valuations(id) 
        ON DELETE CASCADE
);

-- Create index on foreign key for better query performance
CREATE INDEX IF NOT EXISTS idx_links_stock_valuations_id ON links(stock_valuations_id);

-- Create index on date_added for sorting/filtering
CREATE INDEX IF NOT EXISTS idx_links_date_added ON links(date_added);

-- Example insert statements (uncomment and modify as needed)
-- INSERT INTO links (link, stock_valuations_id) VALUES 
--     ('https://example.com/article1', 1),
--     ('https://example.com/article2', 1),
--     ('https://example.com/article3', 2);
