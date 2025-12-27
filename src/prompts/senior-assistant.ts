/**
 * Senior-focused prompt templates for the Medicaid RAG system
 */

/**
 * System prompt for the senior-focused Medicaid assistant
 */
export const SENIOR_SYSTEM_PROMPT = `You are a helpful Medicaid and Medicare assistant specializing in helping seniors and their families understand benefit programs in Pennsylvania.

COMMUNICATION STYLE:
- Use clear, simple language avoiding jargon
- Be patient and thorough in explanations
- Break down complex topics into digestible parts
- Always provide actionable next steps with phone numbers
- Be empathetic about financial and health concerns

KEY PROGRAMS TO KNOW:
- QMB (Qualified Medicare Beneficiary): Pays Medicare Part A and Part B premiums, deductibles, and coinsurance
- SLMB (Specified Low-Income Medicare Beneficiary): Pays Part B premium only
- QI (Qualifying Individual): Pays Part B premium only, higher income limit than SLMB
- Extra Help/LIS: Prescription drug cost assistance for Medicare Part D
- LIFE/PACE: All-inclusive care programs for nursing-home-eligible seniors living at home
- CHC Waiver: Home and community-based care alternative to nursing homes
- PACE/PACENET: Pennsylvania prescription assistance programs (separate from federal PACE)

IMPORTANT RULES:
1. Only use information from the provided documents
2. Always cite sources with [N] notation
3. Include relevant phone numbers and websites when available
4. For sensitive topics (estate planning, asset transfers), recommend professional help
5. If information seems outdated, note that limits change annually
6. Never provide specific legal or financial advice
7. Always mention that eligibility should be confirmed with the local CAO

CHESTER COUNTY RESOURCES:
- Chester County CAO: 610-466-1000
- APPRISE (Medicare counseling): 610-344-6350
- PA MEDI Helpline: 1-800-783-7067
- PHLP (Health Law Project): 1-800-274-3258
- COMPASS (online applications): www.compass.state.pa.us`;

/**
 * Answer format instructions for senior-friendly responses
 */
export const SENIOR_ANSWER_FORMAT = `
Format your response as follows:

1. **Direct Answer**: Start with a clear, direct answer to the question

2. **Program Information**: If applicable, explain relevant programs including:
   - What the program provides
   - Basic eligibility requirements
   - Current income/asset limits (if known)

3. **Next Steps**: Provide clear action items:
   - Phone numbers to call
   - Websites to visit
   - Documents to gather

4. **Citations**: End with [N] references to the source documents

Keep your response concise but complete. Use bullet points for lists.
If the question involves estate planning, asset transfers, or legal matters,
include a brief note recommending consultation with an elder law attorney.`;

/**
 * Context formatting for the LLM
 */
export function formatContextForSeniors(
  contexts: Array<{
    index: number;
    content: string;
    filename: string;
    pageNumber?: number;
  }>
): string {
  return contexts
    .map(
      (ctx) =>
        `[${ctx.index}] Source: ${ctx.filename}${ctx.pageNumber ? ` (Page ${ctx.pageNumber})` : ''}\n${ctx.content}`
    )
    .join('\n\n---\n\n');
}

/**
 * Generate the user prompt for a query
 */
export function generateUserPrompt(query: string, contextText: string): string {
  return `Context Documents:
${contextText}

---

Question from a senior citizen or their family member: ${query}

${SENIOR_ANSWER_FORMAT}`;
}

/**
 * Common follow-up suggestions based on query type
 */
export const FOLLOW_UP_SUGGESTIONS: Record<string, string[]> = {
  medicare_savings: [
    'Would you like to know how to apply for this program?',
    'Do you need information about income verification documents?',
    'Would you like the phone number for free Medicare counseling?',
  ],
  nursing_home: [
    'Would you like to know about home care alternatives?',
    'Do you need information about spousal protections?',
    'Would you like to speak with a Medicaid counselor?',
  ],
  prescription_help: [
    'Would you like to know about Extra Help/LIS?',
    'Do you need information about PACE or PACENET?',
    'Would you like help comparing drug coverage options?',
  ],
  general: [
    'Is there anything else you would like to know?',
    'Would you like contact information for additional help?',
    'Do you have questions about how to apply?',
  ],
};

/**
 * Get appropriate follow-up suggestions based on query topic
 */
export function getFollowUpSuggestions(queryTopics: string[]): string[] {
  const topicMap: Record<string, keyof typeof FOLLOW_UP_SUGGESTIONS> = {
    QMB: 'medicare_savings',
    SLMB: 'medicare_savings',
    QI: 'medicare_savings',
    'Medicare Savings': 'medicare_savings',
    'nursing home': 'nursing_home',
    'long-term care': 'nursing_home',
    LIFE: 'nursing_home',
    CHC: 'nursing_home',
    prescription: 'prescription_help',
    'Extra Help': 'prescription_help',
    PACE: 'prescription_help',
    PACENET: 'prescription_help',
  };

  for (const topic of queryTopics) {
    for (const [keyword, category] of Object.entries(topicMap)) {
      if (topic.toLowerCase().includes(keyword.toLowerCase())) {
        return FOLLOW_UP_SUGGESTIONS[category];
      }
    }
  }

  return FOLLOW_UP_SUGGESTIONS.general;
}

/**
 * Helpful resources footer for all responses
 */
export const RESOURCES_FOOTER = `
---
**Need More Help?**
- Chester County CAO: 610-466-1000
- APPRISE Medicare Counseling: 610-344-6350
- PHLP (free Medicaid help): 1-800-274-3258
- Apply online: www.compass.state.pa.us`;

/**
 * No-answer response template when documents don't contain relevant info
 */
export const NO_ANSWER_RESPONSE = `I was unable to find specific information about this in the available documents.

Here are some resources that may help:
- **Chester County CAO**: 610-466-1000 - They can answer questions about Medicaid eligibility
- **APPRISE**: 610-344-6350 - Free Medicare counseling for Chester County
- **PHLP Helpline**: 1-800-274-3258 - Free help with Medicaid questions
- **PA COMPASS**: www.compass.state.pa.us - Online applications and information

Would you like me to try rephrasing your question, or can I help with something else?`;
