const LOCALES = ['nl', 'fr', 'en'];
const KEY_SEGMENT_PATTERN = /^[A-Za-z0-9]+$/;
const TRANSLATION_STATUSES = ['approved', 'review-required'];
const DEFAULT_TRANSLATION_STATUS = 'approved';
const REVIEW_REQUIRED_STATUS = 'review-required';

module.exports = {
  LOCALES,
  KEY_SEGMENT_PATTERN,
  TRANSLATION_STATUSES,
  DEFAULT_TRANSLATION_STATUS,
  REVIEW_REQUIRED_STATUS
};
