#!/bin/bash
# Download Priority Documents for Senior-Focused Medicaid RAG System
# Run this script from the project root directory

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create directories
DOCS_DIR="data/raw/priority"
mkdir -p "$DOCS_DIR"

echo "=================================================="
echo "Downloading Priority Documents for Senior RAG System"
echo "=================================================="
echo ""

# Function to download with retry
download_file() {
    local url="$1"
    local filename="$2"
    local description="$3"

    echo -e "${YELLOW}Downloading:${NC} $description"
    echo "  URL: $url"
    echo "  File: $DOCS_DIR/$filename"

    if curl -L -f -o "$DOCS_DIR/$filename" "$url" 2>/dev/null; then
        echo -e "  ${GREEN}SUCCESS${NC}"
    else
        echo -e "  ${RED}FAILED${NC} - Please download manually"
        echo "  Manual URL: $url"
    fi
    echo ""
}

# 1. PHLP 2025 MSP Guide (Medicare Savings Programs)
download_file \
    "https://www.phlp.org/uploads/attachments/cm73cc2hheve0ovu8f4khws2a-2025-msp-guide-final.pdf" \
    "PHLP-2025-MSP-Guide.pdf" \
    "PHLP 2025 Medicare Savings Programs Guide"

# 2. PHLP CHC Waiver Eligibility Guide
download_file \
    "https://www.phlp.org/uploads/attachments/clyx3ht63zlfzgdu8qknzs8vt-accessing-the-chc-waiver-guide-to-eligibility-for-advocates.pdf" \
    "PHLP-CHC-Waiver-Eligibility-Guide.pdf" \
    "PHLP CHC Waiver Eligibility Guide"

# 3. PHLP 2025 Income Limits Fact Sheet
download_file \
    "https://www.phlp.org/uploads/attachments/cm6qkwrn0disdowu8htwgm8ql-2025-monthly-income-and-resource-limits-for-medicaid-and-other-health-programs.pdf" \
    "PHLP-2025-Income-Limits.pdf" \
    "PHLP 2025 Income and Resource Limits Fact Sheet"

# 4. PA DHS Estate Recovery FAQ
download_file \
    "https://www.pa.gov/content/dam/copapwp-pagov/en/dhs/documents/services/other-services/estate-recovery/Estate%20Recovery%20Program%20Brochure%20(English).pdf" \
    "PA-DHS-Estate-Recovery-FAQ.pdf" \
    "PA DHS Estate Recovery Program FAQ"

# 5. PA PACE/PACENET Provider Guide 2025
download_file \
    "https://www.pa.gov/content/dam/copapwp-pagov/en/aging/documents/aging-programs-and-services/health-wellness/documents/pace%20provider%20guide%202025.pdf" \
    "PA-PACE-PACENET-Provider-Guide-2025.pdf" \
    "PA PACE/PACENET Provider Guide 2025"

# 6. PA DHS LIFE Program
download_file \
    "https://www.pa.gov/content/dam/copapwp-pagov/en/dhs/documents/healthchoices/hc-services/documents/PELife_English.pdf" \
    "PA-DHS-LIFE-Program.pdf" \
    "PA DHS LIFE Program Information"

# 7. PHLP Using Medicare & Medicaid Guide
download_file \
    "https://www.phlp.org/uploads/attachments/cm48ldzjkudkbgdu8kdaj36qm-using-medicare-and-medicaid-guide.pdf" \
    "PHLP-Using-Medicare-Medicaid-Guide.pdf" \
    "PHLP Using Medicare and Medicaid Guide"

# 8. PHLP LIS/Extra Help Guide 2025
download_file \
    "https://www.phlp.org/uploads/attachments/cm73ch5qdevfpovu8niv8a0ly-2025-lis-guide.pdf" \
    "PHLP-2025-LIS-Extra-Help-Guide.pdf" \
    "PHLP 2025 LIS/Extra Help Guide"

echo "=================================================="
echo "Download Summary"
echo "=================================================="

# Count successful downloads
DOWNLOADED=$(ls -1 "$DOCS_DIR"/*.pdf 2>/dev/null | wc -l)
echo "Successfully downloaded: $DOWNLOADED files"
echo ""

# List downloaded files with sizes
if [ "$DOWNLOADED" -gt 0 ]; then
    echo "Downloaded files:"
    ls -lh "$DOCS_DIR"/*.pdf 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
fi

echo ""
echo "=================================================="
echo "Web Pages to Save Manually (not PDFs)"
echo "=================================================="
echo ""
echo "The following are web pages. Use your browser to save them as PDF:"
echo ""
echo "1. PA DHS Healthy Horizons (Medicaid for Seniors/Disabled):"
echo "   https://www.pa.gov/agencies/dhs/resources/aging-physical-disabilities/medicaid-older-people-and-people-with-disabilities"
echo "   Save as: $DOCS_DIR/PA-DHS-Healthy-Horizons.pdf"
echo ""
echo "2. PA DHS Long-Term Care & Spousal Rules:"
echo "   https://www.pa.gov/agencies/dhs/resources/aging-physical-disabilities/medicaid-payment-long-term-care"
echo "   Save as: $DOCS_DIR/PA-DHS-Long-Term-Care.pdf"
echo ""
echo "3. PA DHS Estate Recovery Information Page:"
echo "   https://www.pa.gov/agencies/dhs/resources/for-residents/estate-recovery"
echo "   Save as: $DOCS_DIR/PA-DHS-Estate-Recovery-Info.pdf"
echo ""
echo "4. PA Aging PACE Program Overview:"
echo "   https://www.pa.gov/agencies/aging/aging-programs-and-services/pace-program"
echo "   Save as: $DOCS_DIR/PA-Aging-PACE-Overview.pdf"
echo ""
echo "=================================================="
echo "Next Steps"
echo "=================================================="
echo ""
echo "After downloading, verify the document registry:"
echo "  cat data/metadata/document-registry.json"
echo ""
echo "Then ingest the documents:"
echo "  pnpm ingest directory data/raw/priority"
echo ""
