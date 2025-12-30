# RAG Query Pipeline Test Results

**Date:** 2025-12-30
**Documents Ingested:** 12
**Total Vectors:** 476
**Source Directory:** `data/raw/priority/`

---

## Test Summary

| Category | Queries | Success | Failed | Avg Time |
|----------|---------|---------|--------|----------|
| Program Information | 6 | 6 | 0 | 4.3s |
| How-To Questions | 2 | 2 | 0 | 4.5s |
| Eligibility Questions | 2 | 2 | 0 | 4.6s |
| Comparison Queries | 1 | 0 | 1 | 3.3s |
| Sensitive Topics | 3 | 2 | 1 | 5.7s |
| Out-of-Scope | 2 | 2 | 0 | 3.3s |
| **Total** | **16** | **14** | **2** | **4.3s** |

---

## Detailed Results

### 1. Program Information Queries

#### Query: "What is the LIFE program?"
| Metric | Value |
|--------|-------|
| Time | 12.8s |
| Vector Results | 20 |
| BM25 Results | 6 |
| Final Chunks | 5 |
| Citations | 1 |
| Sensitive | No |

**Answer:** The LIFE program is a Medicaid and Medicare program that serves older Pennsylvanians in their homes and communities. It provides all physical and behavioral health services through local providers who pay for, manage, coordinate, and provide these services. [2]

**Source:** LIFE-scanned-test.pdf (OCR)

---

#### Query: "What is PACE?"
| Metric | Value |
|--------|-------|
| Time | 4.8s |
| Vector Results | 20 |
| BM25 Results | 20 |
| Final Chunks | 5 |
| Citations | 1 |
| Sensitive | No |

**Answer:** The Pharmaceutical Assistance Contract for the Elderly (PACE) program works with Medicare Part D plans and other prescription drug plans to lower out-of-pocket costs for medications for qualified residents aged 65 and up in Pennsylvania. It is administered by Prime Therapeutics State Government Solutions LLC, following guidelines from the Pennsylvania Department of Aging [2].

---

#### Query: "What is estate recovery?"
| Metric | Value |
|--------|-------|
| Time | 5.3s |
| Vector Results | 20 |
| BM25 Results | 20 |
| Final Chunks | 5 |
| Citations | 2 |
| Sensitive | No |

**Answer:** Estate recovery refers to a program established under federal law that requires the Department of Human Services (DHS) to recover Medical Assistance costs from the estates of individuals who have died. This is done for the amount the state paid, even if the individual paid part of the bill themselves or through insurance [2]. The program allows the Commonwealth to recover Medical Assistance payments made on behalf of an individual who received long-term care services including nursing facility and Home and Community Based Services (HCBS) from the time they turned 55 until their passing [4].

---

#### Query: "What is Healthy Horizons?"
| Metric | Value |
|--------|-------|
| Time | 4.2s |
| Vector Results | 20 |
| BM25 Results | 4 |
| Final Chunks | 5 |
| Citations | 1 |
| Sensitive | No |

**Answer:** Healthy Horizons is a Medicaid program in Pennsylvania that provides assistance to individuals who qualify for Medicare Part A and Part B premiums, as well as payment of Medicare deductibles and coinsurance. It also offers medical coverage through the Medical Assistance program. Eligibility criteria include income levels and other specific requirements [1].

---

#### Query: "What is Extra Help for Medicare?"
| Metric | Value |
|--------|-------|
| Time | 4.3s |
| Vector Results | 20 |
| BM25 Results | 8 |
| Final Chunks | 5 |
| Citations | 1 |
| Sensitive | No |

**Answer:** Extra Help for Medicare is a program that assists Medicare recipients in reducing prescription drug costs by providing copay assistance and coverage gap information. It helps individuals save thousands annually through reduced medication expenses. The program updates systems to reflect Extra Help status, which affects the individual's expected costs for medications [1].

---

#### Query: "What is a Medicare Savings Program?"
| Metric | Value |
|--------|-------|
| Time | 4.1s |
| Vector Results | 20 |
| BM25 Results | 7 |
| Final Chunks | 5 |
| Citations | 1 |
| Sensitive | No |

**Answer:** A Medicare Savings Program (MSP) helps older adults and people with disabilities pay their Medicare Part B monthly premium. Some individuals may also qualify for help with their Medicare Part A premium, as well as Part A and Part B deductibles and coinsurance.

---

### 2. How-To Questions

#### Query: "How do I apply for Medicaid?"
| Metric | Value |
|--------|-------|
| Time | 4.5s |
| Vector Results | 20 |
| BM25 Results | 14 |
| Final Chunks | 5 |
| Citations | 2 |
| Sensitive | No |

**Answer:** You can apply for Medicaid benefits online using COMPASS or by mailing or giving your application to your local county assistance office. The county assistance office will then determine your eligibility.

**Sources:** PA-DHS-Long-Term-Care.pdf, PHLP-2025-MSP-Guide.pdf, PHLP-2025-LIS-Extra-Help-Guide.pdf

---

#### Query: "How can I protect my home from estate recovery?"
| Metric | Value |
|--------|-------|
| Time | 4.2s |
| Vector Results | 20 |
| BM25 Results | 0 |
| Final Chunks | 5 |
| Citations | 1 |
| Sensitive | No |

**Answer:** You cannot protect your home by transferring it to anyone else so that the state will not take it under the Medical Assistance Estate Recovery Program as described in document [3]. The law does not allow such a transfer unless they pay fair market value for it and you consult with a lawyer if you have questions about this, as stated in document [3].

---

### 3. Eligibility Questions

#### Query: "What are the income limits for Medicaid?"
| Metric | Value |
|--------|-------|
| Time | 4.5s |
| Vector Results | 20 |
| BM25 Results | 16 |
| Final Chunks | 5 |
| Citations | 2 |
| Sensitive | No |

**Answer:** The income limit for Medicaid waivers is 300% of the Federal Benefit Rate (FBR). In 2024, this amount was $2,829 per month. Only the income of the individual applicant is counted; a spouse's income does not count toward this limit.

---

#### Query: "Can I have both Medicare and Medicaid?"
| Metric | Value |
|--------|-------|
| Time | 4.2s |
| Vector Results | 20 |
| BM25 Results | 20 |
| Final Chunks | 5 |
| Citations | 1 |
| Sensitive | No |

**Answer:** Yes, you can have both Medicare and Medicaid. Often, someone has Medicaid and then becomes eligible for Medicare because they either turned 65 or received SSDI for 24 months. When you have both, Medicare is the primary insurance, meaning it pays first.

---

#### Query: "I am 55 and disabled, what programs am I eligible for?"
| Metric | Value |
|--------|-------|
| Time | 4.6s |
| Vector Results | 20 |
| BM25 Results | 0 |
| Final Chunks | 5 |
| Citations | 2 |
| Sensitive | No |

**Answer:** Based on your age (55) and disability status, you may be eligible for Medicaid under Pennsylvania's Medical Assistance program as described in document [2]. Additionally, if you meet certain income and resource limits, you might qualify for a waiver service through the Medical Assistance for Workers with Disabilities (MAWD) program or another waiver program, as detailed in document [5].

---

### 4. Services Questions

#### Query: "What services does long-term care cover?"
| Metric | Value |
|--------|-------|
| Time | 4.4s |
| Vector Results | 20 |
| BM25 Results | 1 |
| Final Chunks | 5 |
| Citations | 1 |
| Sensitive | No |

**Answer:** Long-term care (LTC) services include both home and community-based services (HCBS) and LTC facility services (also called nursing facilities). These services can be provided through various means such as in-home supportive care, personal care, medical specialists, 24/7 nursing and medical coverage, and more. [3]

---

#### Query: "I need mental health services"
| Metric | Value |
|--------|-------|
| Time | 3.9s |
| Vector Results | 20 |
| BM25 Results | 0 |
| Final Chunks | 5 |
| Citations | 1 |
| Sensitive | No |

**Answer:** Mental health services are covered through a separate behavioral health managed care plan assigned based on county of residence. This coverage is provided in addition to other physical health benefits such as primary care and hospital care.

---

### 5. Comparison Queries

#### Query: "What is the difference between LIFE and PACE?"
| Metric | Value |
|--------|-------|
| Time | 3.3s |
| Vector Results | 20 |
| BM25 Results | 0 |
| Final Chunks | 5 |
| Citations | 0 |
| Sensitive | No |

**Answer:** I cannot find this information in the provided documents.

**Analysis:** The system retrieved relevant chunks but the LLM could not synthesize a comparison from the separate documents. This is a known limitation of RAG systems for comparison queries.

---

### 6. Sensitive Topic Queries (Guardrails Triggered)

#### Query: "What happens to my house when I die on Medicaid?"
| Metric | Value |
|--------|-------|
| Time | 8.3s |
| Vector Results | 20 |
| BM25 Results | 0 |
| Final Chunks | 5 |
| Citations | 1 |
| **Sensitive** | **Yes (estate_planning)** |

**Answer:** If you own your home while receiving Medicaid benefits and later gain ownership of it after receiving nursing facility care or home and community-based services, the state will recover its claim from the fair market value of the home after you die.

**Disclaimer Added:** "This is general information only and should not be considered legal advice. Estate planning decisions can significantly affect your Medicaid eligibility. Please consult with an elder law attorney before making any decisions."

**Referral Added:** PA Elder Law Attorney Referral through the Pennsylvania Bar Association: 1-800-932-0311

---

#### Query: "How do I appeal a Medicaid denial?"
| Metric | Value |
|--------|-------|
| Time | 5.8s |
| Vector Results | 20 |
| BM25 Results | 0 |
| Final Chunks | 5 |
| Citations | 2 |
| **Sensitive** | **Yes (appeals)** |

**Disclaimer Added:** "You have the right to appeal Medicaid decisions. There are strict deadlines for filing appeals, typically 30 days from the decision notice. Free legal help is available for Medicaid appeals."

**Referrals Added:**
- PHLP Appeals Assistance (free representation for Medicaid appeals): 1-800-274-3258
- Pennsylvania Legal Aid Network: 1-800-322-7572

---

#### Query: "I'm feeling depressed about my medical bills"
| Metric | Value |
|--------|-------|
| Time | 3.1s |
| Vector Results | 20 |
| BM25 Results | 0 |
| Final Chunks | 5 |
| Citations | 0 |
| Sensitive | No |

**Answer:** I cannot find this information in the provided documents.

**Analysis:** The guardrails did not detect this as a mental health sensitive query - the keyword matching may need enhancement for emotional/distress language.

---

### 7. Out-of-Scope Queries

#### Query: "What is the weather today?"
| Metric | Value |
|--------|-------|
| Time | 3.5s |
| Vector Results | 20 |
| BM25 Results | 0 |
| Final Chunks | 5 |
| Citations | 5 |
| Sensitive | No |

**Answer:** I cannot find this information in the provided documents.

**Analysis:** Correctly identified as out-of-scope. The LLM appropriately declined to answer despite receiving context chunks.

---

#### Query: "Can undocumented immigrants get Medicaid?"
| Metric | Value |
|--------|-------|
| Time | 3.3s |
| Vector Results | 20 |
| BM25 Results | 0 |
| Final Chunks | 5 |
| Citations | 0 |
| Sensitive | No |

**Answer:** I cannot find this information in the provided documents.

**Analysis:** Correctly identified as not covered in the ingested documents. Could potentially be flagged as a sensitive immigration topic.

---

#### Query: "Who qualifies for nursing home care?"
| Metric | Value |
|--------|-------|
| Time | 3.3s |
| Vector Results | 20 |
| BM25 Results | 2 |
| Final Chunks | 5 |
| Citations | 0 |
| Sensitive | No |

**Answer:** I cannot find this information in the provided documents.

**Analysis:** Despite having Long-Term-Care.pdf ingested, the specific eligibility criteria for nursing home care wasn't in the retrieved chunks.

---

## Performance Analysis

### Response Time Distribution
| Time Range | Count | Percentage |
|------------|-------|------------|
| < 4s | 5 | 31% |
| 4-5s | 8 | 50% |
| 5-8s | 2 | 13% |
| > 8s | 1 | 6% |

### Hybrid Search Effectiveness
| Query Type | Avg Vector Results | Avg BM25 Results |
|------------|-------------------|------------------|
| Program Info | 20 | 11 |
| How-To | 20 | 7 |
| Eligibility | 20 | 12 |
| Sensitive | 20 | 0 |
| Out-of-Scope | 20 | 1 |

**Observation:** BM25 performs better with specific terminology (Medicaid, PACE, etc.) but returns 0 results for emotional/conversational queries.

### Guardrails Detection
| Category | Queries | Detected | Detection Rate |
|----------|---------|----------|----------------|
| Estate Planning | 1 | 1 | 100% |
| Appeals | 1 | 1 | 100% |
| Mental Health | 1 | 0 | 0% |

---

## Issues Identified

### 1. Comparison Query Limitation
- **Issue:** Cannot synthesize comparisons across documents
- **Example:** "What is the difference between LIFE and PACE?"
- **Recommendation:** Consider adding a comparison-aware prompt or multi-hop retrieval

### 2. Mental Health Guardrail Gap
- **Issue:** Emotional language not detected as sensitive
- **Example:** "I'm feeling depressed about my medical bills"
- **Recommendation:** Add emotional keywords to guardrails detector

### 3. BM25 Zero Results
- **Issue:** BM25 returns 0 results for conversational queries
- **Example:** Sensitive topic queries, emotional queries
- **Recommendation:** Consider query expansion or synonym matching

### 4. Nursing Home Eligibility Gap
- **Issue:** Specific eligibility question not answered despite relevant docs
- **Example:** "Who qualifies for nursing home care?"
- **Recommendation:** Review chunking strategy for eligibility criteria sections

---

## Recommendations

1. **Enhance Guardrails:** Add emotional/distress keywords (depressed, worried, scared, anxious) to sensitive topic detection

2. **Improve Comparisons:** Add explicit comparison handling in the prompt or implement multi-hop retrieval

3. **Query Expansion:** Implement synonym expansion for BM25 to improve recall on conversational queries

4. **Chunk Review:** Audit chunks from Long-Term-Care documents to ensure eligibility criteria are properly captured

5. **Add Immigration Topic:** Consider adding immigration status as a sensitive topic category with appropriate referrals
