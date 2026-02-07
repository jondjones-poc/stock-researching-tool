-- Create dashboard_watchlist table
-- This table stores the watchlist symbols displayed on the home page/dashboard

CREATE TABLE IF NOT EXISTS dashboard_watchlist (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('GROWTH', 'DIVIDEND & VALUE', 'MARKETS', 'WATCHLIST')),
    icon VARCHAR(10),
    color VARCHAR(20),
    data_source VARCHAR(20) CHECK (data_source IN ('FMP', 'FRED', 'FINNHUB', 'ALPHA_VANTAGE', 'API_NINJAS')),
    fred_series_id VARCHAR(100),
    notes TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_dashboard_watchlist_category ON dashboard_watchlist(category);
CREATE INDEX IF NOT EXISTS idx_dashboard_watchlist_is_active ON dashboard_watchlist(is_active);
CREATE INDEX IF NOT EXISTS idx_dashboard_watchlist_display_order ON dashboard_watchlist(display_order);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_dashboard_watchlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_dashboard_watchlist_updated_at
    BEFORE UPDATE ON dashboard_watchlist
    FOR EACH ROW
    EXECUTE FUNCTION update_dashboard_watchlist_updated_at();

-- Insert existing data from dashboard config
-- GROWTH category
INSERT INTO dashboard_watchlist (symbol, name, category, icon, color, data_source, display_order) VALUES
('CRM', 'Salesforce (CRM)', 'GROWTH', '☁️', 'blue', 'FMP', 1),
('AMD', 'Advanced Micro Devices (AMD)', 'GROWTH', '💻', 'red', 'FMP', 2),
('AMZN', 'Amazon (AMZN)', 'GROWTH', '📦', 'orange', 'FMP', 3),
('AAPL', 'Apple (AAPL)', 'GROWTH', '🍎', 'gray', 'FMP', 4),
('CELH', 'Celsius Holdings (CELH)', 'GROWTH', '🥤', 'orange', 'FMP', 5),
('ELF', 'e.l.f. Beauty (ELF)', 'GROWTH', '💄', 'pink', 'FMP', 6),
('SHOP', 'Shopify (SHOP)', 'GROWTH', '🛍️', 'green', 'FMP', 7),
('GOOGL', 'Alphabet (GOOGL)', 'GROWTH', '🔍', 'blue', 'FMP', 8),
('NVDA', 'NVIDIA (NVDA)', 'GROWTH', '🎮', 'green', 'FMP', 9),
('PYPL', 'PayPal (PYPL)', 'GROWTH', '💳', 'blue', 'FMP', 10),
('SOFI', 'SoFi Technologies (SOFI)', 'GROWTH', '🏦', 'purple', 'FMP', 11),
('PLTR', 'Palantir (PLTR)', 'GROWTH', '🔮', 'purple', 'FMP', 12)
ON CONFLICT (symbol) DO NOTHING;

-- DIVIDEND & VALUE category
INSERT INTO dashboard_watchlist (symbol, name, category, icon, color, data_source, display_order) VALUES
('EL', 'Estée Lauder (EL)', 'DIVIDEND & VALUE', '✏️', 'purple', 'FMP', 1),
('JPM', 'JPMorgan Chase (JPM)', 'DIVIDEND & VALUE', '🏦', 'blue', 'FMP', 2),
('MA', 'Mastercard (MA)', 'DIVIDEND & VALUE', '💳', 'orange', 'FMP', 3),
('NKE', 'Nike (NKE)', 'DIVIDEND & VALUE', '✅', 'black', 'FMP', 4),
('MSFT', 'Microsoft (MSFT)', 'DIVIDEND & VALUE', '🪟', 'blue', 'FMP', 5),
('TGT', 'Target (TGT)', 'DIVIDEND & VALUE', '🎯', 'red', 'FMP', 6),
('CAKE', 'Cheesecake Factory (CAKE)', 'DIVIDEND & VALUE', '🍰', 'orange', 'FMP', 7)
ON CONFLICT (symbol) DO NOTHING;

-- MARKETS category
INSERT INTO dashboard_watchlist (symbol, name, category, icon, color, data_source, fred_series_id, display_order) VALUES
('SPX', 'S&P 500', 'MARKETS', '📊', 'green', 'FRED', 'SP500', 1),
('VIX', 'Volatility Index', 'MARKETS', '📈', 'green', 'FRED', 'VIXCLS', 2),
('US10Y', '10-Year Treasury', 'MARKETS', '🇺🇸', 'blue', 'FRED', 'DGS10', 3),
('DXY', 'Dollar Index', 'MARKETS', '💵', 'green', 'FRED', 'DTWEXBGS', 4),
('GLD', 'Gold Price (GLD)', 'MARKETS', '🥇', 'yellow', 'FMP', NULL, 5),
('BTC', 'Bitcoin', 'MARKETS', '₿', 'orange', 'FRED', 'CBBTCUSD', 6),
('MORTGAGE30Y', '30-Year Mortgage Rate', 'MARKETS', '🏠', 'orange', 'FRED', 'MORTGAGE30US', 7),
('SCHD', 'Schwab US Dividend Equity ETF', 'MARKETS', '💰', 'blue', 'FMP', NULL, 8),
('WTI', 'West Texas Intermediate Crude Oil', 'MARKETS', '🛢️', 'black', 'FRED', 'DCOILWTICO', 9)
ON CONFLICT (symbol) DO NOTHING;

-- WATCHLIST category
INSERT INTO dashboard_watchlist (symbol, name, category, icon, color, data_source, display_order) VALUES
('VICI', 'VICI - VICI Properties Inc.', 'WATCHLIST', '🏢', 'blue', 'FMP', 1),
('TSLA', 'TSLA - Tesla Inc.', 'WATCHLIST', '⚡', 'red', 'FMP', 2),
('KO', 'Coca-Cola (KO)', 'WATCHLIST', '🥤', 'red', 'FMP', 3)
ON CONFLICT (symbol) DO NOTHING;

-- Add comments to the table and columns for documentation
COMMENT ON TABLE dashboard_watchlist IS 'Stores watchlist symbols displayed on the home page/dashboard';
COMMENT ON COLUMN dashboard_watchlist.symbol IS 'Stock symbol (e.g., AAPL, MSFT)';
COMMENT ON COLUMN dashboard_watchlist.name IS 'Display name for the symbol';
COMMENT ON COLUMN dashboard_watchlist.category IS 'Category: GROWTH, DIVIDEND & VALUE, MARKETS, or WATCHLIST';
COMMENT ON COLUMN dashboard_watchlist.icon IS 'Emoji icon for display (optional)';
COMMENT ON COLUMN dashboard_watchlist.color IS 'Color theme for display (optional)';
COMMENT ON COLUMN dashboard_watchlist.data_source IS 'API source: FMP, FRED, FINNHUB, ALPHA_VANTAGE, or API_NINJAS';
COMMENT ON COLUMN dashboard_watchlist.fred_series_id IS 'FRED series ID (required if data_source is FRED)';
COMMENT ON COLUMN dashboard_watchlist.notes IS 'Additional notes about the symbol';
COMMENT ON COLUMN dashboard_watchlist.display_order IS 'Order for display within category (lower numbers first)';
COMMENT ON COLUMN dashboard_watchlist.is_active IS 'Whether this symbol is currently active/visible';
