import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import styles from './QuickTopics.module.css';

interface TopicCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  sampleQuestion: string;
}

const TOPICS: TopicCard[] = [
  {
    id: 'income-limits',
    title: 'Income Limits',
    description: 'Monthly income thresholds for Medicaid eligibility',
    icon: '💵',
    sampleQuestion: 'What are the income limits for Medicaid in Pennsylvania?',
  },
  {
    id: 'medicare-savings',
    title: 'Medicare Savings',
    description: 'QMB, SLMB, and QI programs that help with Medicare costs',
    icon: '🏥',
    sampleQuestion: 'What is the QMB program and how do I qualify?',
  },
  {
    id: 'long-term-care',
    title: 'Long-Term Care',
    description: 'Nursing home coverage and community-based options',
    icon: '🏠',
    sampleQuestion: 'Does Medicaid cover nursing home care in Pennsylvania?',
  },
  {
    id: 'prescription-help',
    title: 'Prescription Help',
    description: 'PACE, PACENET, and Extra Help programs',
    icon: '💊',
    sampleQuestion: 'What is the PACE program for prescription drugs?',
  },
];

/**
 * QuickTopics - Card grid for common Medicaid topics
 * Clicking a card navigates to chat with a sample question
 */
export function QuickTopics() {
  const navigate = useNavigate();

  const handleTopicClick = (topic: TopicCard) => {
    navigate(`/ask?q=${encodeURIComponent(topic.sampleQuestion)}`);
  };

  return (
    <section className={styles.section} aria-labelledby="quick-topics-heading">
      <h2 id="quick-topics-heading" className={styles.heading}>
        Common Topics
      </h2>
      <p className={styles.subheading}>
        Select a topic to get started with a common question
      </p>

      <div className={styles.grid}>
        {TOPICS.map((topic, index) => (
          <motion.button
            key={topic.id}
            className={styles.card}
            onClick={() => handleTopicClick(topic)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className={styles.icon} aria-hidden="true">
              {topic.icon}
            </span>
            <h3 className={styles.title}>{topic.title}</h3>
            <p className={styles.description}>{topic.description}</p>
          </motion.button>
        ))}
      </div>
    </section>
  );
}

export default QuickTopics;
