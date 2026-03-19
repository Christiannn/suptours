-- Prevent duplicate newsletter subscriptions for the same email
ALTER TABLE public.newsletter_subscribers
  ADD CONSTRAINT newsletter_subscribers_email_unique UNIQUE (email);
