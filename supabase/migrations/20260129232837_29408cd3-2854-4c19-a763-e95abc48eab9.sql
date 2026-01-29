-- Add DELETE policy for webhook_logs table
CREATE POLICY "Authenticated users can delete webhook_logs" 
ON public.webhook_logs 
FOR DELETE 
TO authenticated
USING (true);