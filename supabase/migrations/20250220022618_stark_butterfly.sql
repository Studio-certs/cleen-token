/*
  # Add insert policy for transactions table

  1. Security Changes
    - Add policy to allow inserting new transactions
    - This policy allows any authenticated or anonymous user to create transactions
    - Required for the initial transaction creation during checkout
*/

CREATE POLICY "Anyone can create transactions"
  ON transactions
  FOR INSERT
  TO public
  WITH CHECK (true);