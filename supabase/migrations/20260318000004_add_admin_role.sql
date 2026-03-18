-- Add is_admin column to profiles
ALTER TABLE public.profiles 
ADD COLUMN is_admin boolean DEFAULT false;

-- Add a comment for clarity
COMMENT ON COLUMN public.profiles.is_admin IS 'True if the user has global administrative privileges.';
