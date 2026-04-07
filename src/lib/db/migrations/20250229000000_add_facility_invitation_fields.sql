ALTER TABLE `facilities`
  ADD COLUMN IF NOT EXISTS `invitation_token` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `invitation_expires` datetime NULL;

