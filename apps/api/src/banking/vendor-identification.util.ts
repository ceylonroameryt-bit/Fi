/**
 * Utility for automatic vendor and customer identification from bank statement descriptions.
 * Uses intelligent pattern matching, merchant tokenization, and corporate entity extraction.
 */

export interface VendorRule {
  matchKeywords: string[];
  canonicalName: string;
}

export const KNOWN_MERCHANT_VENDORS: VendorRule[] = [
  // Tech & Cloud
  { matchKeywords: ['adobe'], canonicalName: 'Adobe' },
  { matchKeywords: ['google', 'gsuite', 'workspace'], canonicalName: 'Google' },
  { matchKeywords: ['aws', 'amazon web services', 'amzn'], canonicalName: 'Amazon Web Services' },
  { matchKeywords: ['microsoft', 'msft', 'azure', 'office 365', 'm365'], canonicalName: 'Microsoft' },
  { matchKeywords: ['github'], canonicalName: 'GitHub' },
  { matchKeywords: ['slack'], canonicalName: 'Slack' },
  { matchKeywords: ['zoom.us', 'zoom'], canonicalName: 'Zoom' },
  { matchKeywords: ['digitalocean'], canonicalName: 'DigitalOcean' },
  { matchKeywords: ['vercel'], canonicalName: 'Vercel' },
  { matchKeywords: ['atlassian', 'jira', 'confluence', 'trello'], canonicalName: 'Atlassian' },
  { matchKeywords: ['dropbox'], canonicalName: 'Dropbox' },
  { matchKeywords: ['figma'], canonicalName: 'Figma' },
  { matchKeywords: ['canva'], canonicalName: 'Canva' },
  { matchKeywords: ['notion'], canonicalName: 'Notion' },
  { matchKeywords: ['linear'], canonicalName: 'Linear' },
  { matchKeywords: ['intercom'], canonicalName: 'Intercom' },
  { matchKeywords: ['zendesk'], canonicalName: 'Zendesk' },
  { matchKeywords: ['hubspot'], canonicalName: 'HubSpot' },
  { matchKeywords: ['mailchimp', 'intuit mailchimp'], canonicalName: 'Mailchimp' },
  { matchKeywords: ['stripe'], canonicalName: 'Stripe' },
  { matchKeywords: ['gocardless'], canonicalName: 'GoCardless' },
  { matchKeywords: ['xero'], canonicalName: 'Xero' },
  { matchKeywords: ['quickbooks', 'intuit'], canonicalName: 'QuickBooks' },

  // Telecom & Utilities
  { matchKeywords: ['british telecom', 'bt broadband', 'bt group', 'bt business'], canonicalName: 'British Telecom' },
  { matchKeywords: ['vodafone'], canonicalName: 'Vodafone' },
  { matchKeywords: ['o2 tele', 'o2 uk', 'o2 online'], canonicalName: 'O2' },
  { matchKeywords: ['ee limited', 'ee mobile', 'ee telecom'], canonicalName: 'EE Telecom' },
  { matchKeywords: ['virgin media'], canonicalName: 'Virgin Media' },

  // Office Supplies, Hardware & Retail
  { matchKeywords: ['paper & co', 'paper and co'], canonicalName: 'Paper & Co' },
  { matchKeywords: ['screwfix'], canonicalName: 'Screwfix' },
  { matchKeywords: ['toolstation'], canonicalName: 'Toolstation' },
  { matchKeywords: ['wickes'], canonicalName: 'Wickes' },
  { matchKeywords: ['b&q', 'diy.com'], canonicalName: 'B&Q' },
  { matchKeywords: ['travis perkins'], canonicalName: 'Travis Perkins' },
  { matchKeywords: ['officemart', 'office depot', 'staples', 'ryman'], canonicalName: 'Ryman / Office Depot' },

  // Common Business Customers / Partners
  { matchKeywords: ['bright ideas design', 'bright ideas'], canonicalName: 'Bright Ideas Design Co' },
  { matchKeywords: ['global media agency', 'global media'], canonicalName: 'Global Media Agency' },
  { matchKeywords: ['tech innovations', 'tech innovations ltd'], canonicalName: 'Tech Innovations Ltd' },

  // Food, Welfare, Supermarkets & Fuel
  { matchKeywords: ['tesco'], canonicalName: 'Tesco' },
  { matchKeywords: ['sainsbury'], canonicalName: "Sainsbury's" },
  { matchKeywords: ['asda'], canonicalName: 'Asda' },
  { matchKeywords: ['waitrose'], canonicalName: 'Waitrose' },
  { matchKeywords: ['morrison'], canonicalName: 'Morrisons' },
  { matchKeywords: ['pret a manger', 'pret'], canonicalName: 'Pret A Manger' },
  { matchKeywords: ['costa coffee', 'costa'], canonicalName: 'Costa Coffee' },
  { matchKeywords: ['starbucks'], canonicalName: 'Starbucks' },
  { matchKeywords: ['bp connect', 'bp oil', 'bp garage', 'bp petrol'], canonicalName: 'BP' },
  { matchKeywords: ['shell oil', 'shell uk', 'shell service'], canonicalName: 'Shell' },
  { matchKeywords: ['esso'], canonicalName: 'Esso' },
  { matchKeywords: ['texaco'], canonicalName: 'Texaco' },

  // Government & Statutory
  { matchKeywords: ['hmrc', 'vat return', 'paye'], canonicalName: 'HM Revenue & Customs (HMRC)' },
];

/**
 * Extracts candidate vendor or customer name from a bank transaction line.
 */
export function extractVendorOrCustomerName(
  description: string,
  payee?: string | null,
  _isMoneyIn?: boolean,
): string | null {
  const rawText = `${payee || ''} ${description || ''}`.trim();
  if (!rawText) return null;

  const textLower = rawText.toLowerCase();

  // 1. Direct known vendor dictionary match
  for (const rule of KNOWN_MERCHANT_VENDORS) {
    if (rule.matchKeywords.some((kw) => textLower.includes(kw))) {
      return rule.canonicalName;
    }
  }

  // 2. Pattern: "Vendor/Customer - Purpose / Sub-description"
  // E.g.: "Bright Ideas Design Co - Workshop Advance Deposit" -> "Bright Ideas Design Co"
  if (description.includes(' - ')) {
    const prefix = description.split(' - ')[0].trim();
    if (prefix.length >= 3 && prefix.length <= 60 && !/^(card|dd|bacs|chq|transfer|payment)/i.test(prefix)) {
      return cleanEntityName(prefix);
    }
  }

  // 3. Pattern: Corporate Entity suffixes (Ltd, Limited, LLC, Inc, Corp, Co, PLC)
  // E.g. "Tech Innovations Ltd Q4 Retainer" -> "Tech Innovations Ltd"
  const suffixMatch = rawText.match(/([A-Za-z0-9&.,' ]+\b(?:Ltd|Limited|LLC|Inc|Corp|Co|PLC)\b)/i);
  if (suffixMatch && suffixMatch[1].trim().length >= 3 && suffixMatch[1].trim().length <= 60) {
    return cleanEntityName(suffixMatch[1].trim());
  }

  // 4. Payee field if explicitly present and clean
  if (payee && payee.trim().length >= 2 && !/^(card|bacs|transfer|pos)/i.test(payee.trim())) {
    return cleanEntityName(payee.trim());
  }

  return null;
}

/**
 * Normalises company name for consistent matching.
 */
function cleanEntityName(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
    .trim();
}
