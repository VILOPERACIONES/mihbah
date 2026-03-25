CREATE POLICY "Users can delete own conversaciones"
ON public.conversaciones
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);