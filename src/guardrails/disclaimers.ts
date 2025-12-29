import { SensitiveCategory } from './detector.js';

/**
 * Disclaimer templates for sensitive topics
 */
const DISCLAIMERS: Record<SensitiveCategory, string> = {
  estate_planning:
    'This is general information only and should not be considered legal advice. ' +
    'Estate planning decisions can significantly affect your Medicaid eligibility. ' +
    'Please consult with an elder law attorney before making any decisions.',

  spend_down:
    'Medicaid has strict rules about asset transfers and spend-down strategies. ' +
    'Improper transfers can result in penalty periods that delay your eligibility. ' +
    'Consult with a Medicaid planning professional before taking any action.',

  asset_transfer:
    'Asset transfers within 5 years of applying for Medicaid ("look-back period") ' +
    'can result in penalties that delay your coverage. This includes transfers to ' +
    'family members, trusts, or others. Please consult an elder law attorney.',

  spousal_complex:
    'Spousal situations involving Medicaid can be legally and emotionally complex. ' +
    'Pennsylvania has specific rules about spousal protections and responsibilities. ' +
    'Free counseling is available through PHLP (Pennsylvania Health Law Project).',

  appeals:
    'You have the right to appeal Medicaid decisions. There are strict deadlines ' +
    'for filing appeals, typically 30 days from the decision notice. ' +
    'Free legal help is available for Medicaid appeals.',

  look_back_period:
    'Pennsylvania applies a 60-month (5-year) look-back period for asset transfers. ' +
    'Any transfers made during this period may result in a penalty period that delays ' +
    'Medicaid coverage. Penalties are calculated based on the value transferred divided by ' +
    'the average monthly cost of nursing home care. Consult an elder law attorney before ' +
    'making any transfers.',
};

/**
 * Referral suggestions for each category
 */
const REFERRALS: Record<SensitiveCategory, string> = {
  estate_planning:
    'PA Elder Law Attorney Referral through the Pennsylvania Bar Association: 1-800-932-0311',

  spend_down:
    'Pennsylvania Health Law Project (PHLP) - Free Medicaid guidance: 1-800-274-3258\n' +
    'Website: www.phlp.org',

  asset_transfer:
    'Elder Law Attorney - Find one through the National Academy of Elder Law Attorneys (NAELA)\n' +
    'PA Referral: 1-800-932-0311',

  spousal_complex:
    'PHLP Helpline (free, confidential help for complex Medicaid situations): 1-800-274-3258\n' +
    'Chester County CAO: 610-466-1000',

  appeals:
    'PHLP Appeals Assistance (free representation for Medicaid appeals): 1-800-274-3258\n' +
    'Pennsylvania Legal Aid Network: 1-800-322-7572',

  look_back_period:
    'Elder Law Attorney - Specializing in Medicaid planning and asset protection\n' +
    'PA Bar Association Referral: 1-800-932-0311\n' +
    'PHLP (free guidance on Medicaid rules): 1-800-274-3258',
};

/**
 * Chester County specific resources
 */
export const CHESTER_COUNTY_RESOURCES = {
  cao: {
    name: 'Chester County Assistance Office (CAO)',
    phone: '610-466-1000',
    address: '201 Boot Road, Downingtown, PA 19335',
  },
  apprise: {
    name: 'APPRISE Medicare Counseling (Chester County)',
    phone: '610-344-6350',
    description: 'Free Medicare counseling and assistance',
  },
  paMediHelpline: {
    name: 'PA MEDI Helpline',
    phone: '1-800-783-7067',
    description: 'Medicare enrollment and assistance',
  },
  phlp: {
    name: 'Pennsylvania Health Law Project',
    phone: '1-800-274-3258',
    website: 'www.phlp.org',
    description: 'Free Medicaid legal help',
  },
};

/**
 * Get disclaimer text for a sensitive category
 */
export function getDisclaimer(category: SensitiveCategory): string {
  return DISCLAIMERS[category] || 'Please consult with a professional for specific advice.';
}

/**
 * Get referral information for a sensitive category
 */
export function getReferral(category: SensitiveCategory): string {
  return REFERRALS[category] || 'Contact PHLP at 1-800-274-3258 for assistance.';
}

/**
 * Get all Chester County resources as formatted text
 */
export function getChesterCountyResources(): string {
  const resources = Object.values(CHESTER_COUNTY_RESOURCES);
  return resources
    .map((r) => `**${r.name}**\nPhone: ${r.phone}${'description' in r && r.description ? `\n${r.description}` : ''}`)
    .join('\n\n');
}

/**
 * Get a general Medicaid help disclaimer for all responses
 */
export function getGeneralDisclaimer(): string {
  return (
    'This information is provided for educational purposes only and may not reflect ' +
    'the most current regulations. Income and asset limits are updated annually. ' +
    'For the most accurate information, contact your local County Assistance Office ' +
    'or call PHLP at 1-800-274-3258.'
  );
}
