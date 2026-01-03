import { useState } from 'react';
import { motion } from 'framer-motion';
import type { DisclaimerInfo, SensitiveCategory } from '../types';
import styles from './DisclaimerBanner.module.css';

interface DisclaimerBannerProps {
  disclaimer: DisclaimerInfo;
  /** Whether the banner can be dismissed */
  dismissible?: boolean;
}

/**
 * DisclaimerBanner - Warm amber notice for sensitive topics
 * Non-alarming but clear notice with professional referrals
 */
export function DisclaimerBanner({ disclaimer, dismissible = true }: DisclaimerBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  const categoryInfo = getCategoryInfo(disclaimer.category);

  return (
    <motion.div
      className={styles.banner}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      role="note"
      aria-label={`Important notice about ${categoryInfo.title}`}
    >
      <div className={styles.iconWrapper}>
        <span className={styles.icon} aria-hidden="true">
          {categoryInfo.icon}
        </span>
      </div>

      <div className={styles.content}>
        <h4 className={styles.title}>{categoryInfo.title}</h4>
        <p className={styles.text}>{disclaimer.text}</p>

        {/* Professional referral with click-to-call */}
        {disclaimer.referral && (
          <div className={styles.referral}>
            <span className={styles.referralLabel}>For professional guidance:</span>
            <p className={styles.referralText}>{disclaimer.referral}</p>
          </div>
        )}

        {/* Category-specific phone numbers */}
        <div className={styles.contacts}>
          {categoryInfo.contacts.map((contact) => (
            <a
              key={contact.phone}
              href={`tel:${contact.phone.replace(/\D/g, '')}`}
              className={styles.contactLink}
            >
              <span className={styles.contactIcon} aria-hidden="true">📞</span>
              <span className={styles.contactInfo}>
                <span className={styles.contactName}>{contact.name}</span>
                <span className={styles.contactPhone}>{contact.phone}</span>
              </span>
            </a>
          ))}
        </div>
      </div>

      {dismissible && (
        <button
          className={styles.dismissButton}
          onClick={() => setIsDismissed(true)}
          aria-label="Dismiss this notice"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </motion.div>
  );
}

interface ContactInfo {
  name: string;
  phone: string;
}

interface CategoryInfo {
  title: string;
  icon: string;
  contacts: ContactInfo[];
}

/**
 * Get display info for each sensitive category
 */
function getCategoryInfo(category: SensitiveCategory): CategoryInfo {
  const baseContacts: ContactInfo[] = [
    { name: 'PA Health Law Project', phone: '1-800-274-3258' },
  ];

  const legalContacts: ContactInfo[] = [
    { name: 'Elder Law Referral', phone: '1-800-932-0311' },
    { name: 'PA Legal Aid', phone: '1-800-322-7572' },
  ];

  switch (category) {
    case 'estate_planning':
      return {
        title: 'Estate Planning Considerations',
        icon: '📋',
        contacts: [...legalContacts],
      };

    case 'spend_down':
      return {
        title: 'Spend-Down Strategies',
        icon: '💰',
        contacts: [...baseContacts, ...legalContacts],
      };

    case 'asset_transfer':
      return {
        title: 'Asset Transfer Rules',
        icon: '⚠️',
        contacts: [...legalContacts],
      };

    case 'spousal_complex':
      return {
        title: 'Spousal Eligibility',
        icon: '👥',
        contacts: [...baseContacts, ...legalContacts],
      };

    case 'appeals':
      return {
        title: 'Appeals Process',
        icon: '⚖️',
        contacts: [
          ...baseContacts,
          { name: 'PA Legal Aid', phone: '1-800-322-7572' },
        ],
      };

    case 'look_back_period':
      return {
        title: 'Look-Back Period',
        icon: '📅',
        contacts: [...legalContacts],
      };

    default:
      return {
        title: 'Important Information',
        icon: 'ℹ️',
        contacts: baseContacts,
      };
  }
}

export default DisclaimerBanner;
