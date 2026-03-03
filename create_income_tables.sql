-- Create income_type table
CREATE TABLE IF NOT EXISTS income_type (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

-- Create income_source table
CREATE TABLE IF NOT EXISTS income_source (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    income_type_id INTEGER NOT NULL,
    FOREIGN KEY (income_type_id) REFERENCES income_type(id) ON DELETE CASCADE
);

-- Create income_entry table
CREATE TABLE IF NOT EXISTS income_entry (
    id SERIAL PRIMARY KEY,
    income_source_id INTEGER NOT NULL,
    add_date DATE NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (income_source_id) REFERENCES income_source(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_income_source_type ON income_source(income_type_id);
CREATE INDEX IF NOT EXISTS idx_income_entry_source ON income_entry(income_source_id);
CREATE INDEX IF NOT EXISTS idx_income_entry_date ON income_entry(add_date);
