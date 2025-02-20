/*
  # Add blockchain transaction columns

  1. Changes
    - Add `blockchain_tx_hash` column to store the transaction hash
    - Add `completed_at` timestamp to track when the transaction was completed
    - Add `error_message` column for storing any error details

  2. Security
    - No changes to existing policies
*/

-- Add new columns to transactions table
DO $$ 
BEGIN
  -- Add blockchain_tx_hash column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'blockchain_tx_hash'
  ) THEN
    ALTER TABLE transactions ADD COLUMN blockchain_tx_hash text;
  END IF;

  -- Add completed_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE transactions ADD COLUMN completed_at timestamptz;
  END IF;

  -- Add error_message column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE transactions ADD COLUMN error_message text;
  END IF;
END $$;