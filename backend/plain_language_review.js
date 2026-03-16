const PLAIN_LANGUAGE_KEYS = {
  einfach: {
    reviewed: 'de-EINFACH',
    suggested: 'de-EINFACH-SUGGESTED',
  },
  leicht: {
    reviewed: 'de-LEICHT',
    suggested: 'de-LEICHT-SUGGESTED',
  },
};

export function applyPlainLanguageReview(
  translations,
  {
    mode,
    action,
    reviewer = null,
    now = new Date().toISOString(),
  }
) {
  const keys = PLAIN_LANGUAGE_KEYS[mode];
  if (!keys) {
    throw new Error(`Unsupported plain-language mode: ${mode}`);
  }
  if (!['approve', 'reject'].includes(action)) {
    throw new Error(`Unsupported plain-language action: ${action}`);
  }

  const nextTranslations = { ...(translations || {}) };
  const suggested = nextTranslations[keys.suggested];
  const reviewed = nextTranslations[keys.reviewed];
  const sourceRecord = suggested || reviewed;

  if (!sourceRecord || typeof sourceRecord !== 'object') {
    throw new Error(`No ${mode} plain-language translation available`);
  }

  if (action === 'approve') {
    const approvedRecord = {
      ...sourceRecord,
      reviewed: true,
      variant: mode,
      reviewStatus: 'approved',
      reviewedBy: reviewer || sourceRecord.reviewedBy || undefined,
      reviewedAt: now,
      timestamp: now,
    };
    nextTranslations[keys.reviewed] = approvedRecord;
    if (suggested) {
      nextTranslations[keys.suggested] = {
        ...suggested,
        variant: mode,
        reviewStatus: 'approved',
        reviewed: true,
        reviewedBy: reviewer || suggested.reviewedBy || undefined,
        reviewedAt: now,
      };
    }
    return nextTranslations;
  }

  if (suggested) {
    nextTranslations[keys.suggested] = {
      ...suggested,
      variant: mode,
      reviewStatus: 'rejected',
      reviewed: false,
      reviewedBy: reviewer || suggested.reviewedBy || undefined,
      reviewedAt: now,
    };
  }

  return nextTranslations;
}
