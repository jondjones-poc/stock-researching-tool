-- Baseline: public.portfolio_data
-- Prerequisite: stock_ticker_cache(instrument_id) must exist (FK on portfolio_data.instrument_id).
-- After this, run 003_portfolio_data_is_dividend.sql if you need is_dividend on portfolio_data.

CREATE TABLE IF NOT EXISTS public.portfolio_data (
  id serial NOT NULL,
  position_id bigint NOT NULL,
  instrument_id integer NOT NULL,
  shares_owned numeric(18, 8) NOT NULL,
  buy_cost numeric(18, 4) NOT NULL,
  current_price numeric(18, 4) NOT NULL,
  current_value numeric(18, 4) NULL,
  gain_loss numeric(18, 4) NULL,
  gain_loss_percent numeric(10, 4) NULL,
  dividend_per_share numeric(10, 4) NULL DEFAULT 0,
  annual_dividend numeric(18, 4) NULL DEFAULT 0,
  dividend_yield numeric(10, 4) NULL,
  dividend_growth_rate numeric(10, 4) NULL,
  pnl numeric(18, 4) NULL,
  open_date_time timestamp without time zone NULL,
  settlement_type_id integer NULL,
  is_buy boolean NULL,
  leverage integer NULL,
  amount numeric(18, 4) NULL,
  initial_amount_in_dollars numeric(18, 4) NULL,
  is_settled boolean NULL,
  is_detached boolean NULL,
  last_updated timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
  stock_ticker text NULL,
  ticker text NULL,
  CONSTRAINT portfolio_data_pkey PRIMARY KEY (id),
  CONSTRAINT portfolio_data_position_id_key UNIQUE (position_id),
  CONSTRAINT portfolio_data_instrument_id_fkey FOREIGN KEY (instrument_id)
    REFERENCES stock_ticker_cache (instrument_id) ON DELETE RESTRICT
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_portfolio_data_instrument_id
  ON public.portfolio_data USING btree (instrument_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_portfolio_data_last_updated
  ON public.portfolio_data USING btree (last_updated) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_portfolio_data_position_id
  ON public.portfolio_data USING btree (position_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_portfolio_data_active
  ON public.portfolio_data USING btree (is_settled, shares_owned) TABLESPACE pg_default
  WHERE (is_settled = true) AND (shares_owned > (0)::numeric);
