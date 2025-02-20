/*
  # Update transaction table policies

  1. Security Changes
    - Update the select policy to allow reading transactions
    - This ensures both creation and reading of transactions work properly
    - Required for viewing transaction status and history
*/

-- Drop the existing select policy
DROP POLICY IF EXISTS "Users can read their own transactions" ON transactions;

-- Create a new select policy that allows public access
CREATE POLICY "Anyone can read transactions"
  ON transactions
  FOR SELECT
  TO public
  USING (true);