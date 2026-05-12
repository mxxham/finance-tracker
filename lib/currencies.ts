export interface UserSettings {
  currency: string;
  locale: string;
  payday: number;
  theme: string;
  date_format: string;
  week_start: string;
  default_view: string;
  show_decimals: boolean;
  compact_numbers: boolean;
  enable_animations: boolean;
  budget_alerts: boolean;
  budget_alert_threshold: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  currency: 'IDR',
  locale: 'id-ID',
  payday: 25,
  theme: 'midnight',
  date_format: 'DD/MM/YYYY',
  week_start: 'monday',
  default_view: 'overview',
  show_decimals: false,
  compact_numbers: true,
  enable_animations: true,
  budget_alerts: true,
  budget_alert_threshold: 80,
};

export const CURRENCIES: { code: string; name: string; locale: string; symbol: string }[] = [
  { code: 'IDR', name: 'Indonesian Rupiah',     locale: 'id-ID', symbol: 'Rp' },
  { code: 'USD', name: 'US Dollar',              locale: 'en-US', symbol: '$'  },
  { code: 'EUR', name: 'Euro',                   locale: 'de-DE', symbol: '€'  },
  { code: 'GBP', name: 'British Pound',          locale: 'en-GB', symbol: '£'  },
  { code: 'JPY', name: 'Japanese Yen',           locale: 'ja-JP', symbol: '¥'  },
  { code: 'CNY', name: 'Chinese Yuan',           locale: 'zh-CN', symbol: '¥'  },
  { code: 'KRW', name: 'South Korean Won',       locale: 'ko-KR', symbol: '₩'  },
  { code: 'SGD', name: 'Singapore Dollar',       locale: 'en-SG', symbol: 'S$' },
  { code: 'MYR', name: 'Malaysian Ringgit',      locale: 'ms-MY', symbol: 'RM' },
  { code: 'THB', name: 'Thai Baht',              locale: 'th-TH', symbol: '฿'  },
  { code: 'PHP', name: 'Philippine Peso',        locale: 'en-PH', symbol: '₱'  },
  { code: 'VND', name: 'Vietnamese Dong',        locale: 'vi-VN', symbol: '₫'  },
  { code: 'INR', name: 'Indian Rupee',           locale: 'en-IN', symbol: '₹'  },
  { code: 'PKR', name: 'Pakistani Rupee',        locale: 'ur-PK', symbol: '₨'  },
  { code: 'BDT', name: 'Bangladeshi Taka',       locale: 'bn-BD', symbol: '৳'  },
  { code: 'AUD', name: 'Australian Dollar',      locale: 'en-AU', symbol: 'A$' },
  { code: 'NZD', name: 'New Zealand Dollar',     locale: 'en-NZ', symbol: 'NZ$'},
  { code: 'CAD', name: 'Canadian Dollar',        locale: 'en-CA', symbol: 'CA$'},
  { code: 'CHF', name: 'Swiss Franc',            locale: 'de-CH', symbol: 'Fr' },
  { code: 'HKD', name: 'Hong Kong Dollar',       locale: 'zh-HK', symbol: 'HK$'},
  { code: 'TWD', name: 'New Taiwan Dollar',      locale: 'zh-TW', symbol: 'NT$'},
  { code: 'SAR', name: 'Saudi Riyal',            locale: 'ar-SA', symbol: '﷼'  },
  { code: 'AED', name: 'UAE Dirham',             locale: 'ar-AE', symbol: 'د.إ'},
  { code: 'TRY', name: 'Turkish Lira',           locale: 'tr-TR', symbol: '₺'  },
  { code: 'BRL', name: 'Brazilian Real',         locale: 'pt-BR', symbol: 'R$' },
  { code: 'MXN', name: 'Mexican Peso',           locale: 'es-MX', symbol: '$'  },
  { code: 'ZAR', name: 'South African Rand',     locale: 'en-ZA', symbol: 'R'  },
  { code: 'NGN', name: 'Nigerian Naira',         locale: 'en-NG', symbol: '₦'  },
  { code: 'EGP', name: 'Egyptian Pound',         locale: 'ar-EG', symbol: '£'  },
  { code: 'SEK', name: 'Swedish Krona',          locale: 'sv-SE', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone',        locale: 'nb-NO', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone',           locale: 'da-DK', symbol: 'kr' },
  { code: 'PLN', name: 'Polish Złoty',           locale: 'pl-PL', symbol: 'zł' },
  { code: 'CZK', name: 'Czech Koruna',           locale: 'cs-CZ', symbol: 'Kč' },
  { code: 'HUF', name: 'Hungarian Forint',       locale: 'hu-HU', symbol: 'Ft' },
  { code: 'RUB', name: 'Russian Ruble',          locale: 'ru-RU', symbol: '₽'  },
  { code: 'UAH', name: 'Ukrainian Hryvnia',      locale: 'uk-UA', symbol: '₴'  },
  { code: 'ILS', name: 'Israeli Shekel',         locale: 'he-IL', symbol: '₪'  },
  { code: 'QAR', name: 'Qatari Riyal',           locale: 'ar-QA', symbol: 'ر.ق'},
  { code: 'KWD', name: 'Kuwaiti Dinar',          locale: 'ar-KW', symbol: 'د.ك'},
];

// No-decimal currencies (whole-number only by convention)
const ZERO_DECIMAL = new Set(['IDR', 'JPY', 'KRW', 'VND', 'HUF', 'CLP', 'ISK', 'TWD', 'BIF', 'GNF', 'KMF', 'MGA', 'PYG', 'RWF', 'UGX', 'XAF', 'XOF', 'XPF']);

export function makeFmt(settings: Pick<UserSettings, 'currency' | 'locale' | 'show_decimals'>) {
  const maxFrac = settings.show_decimals && !ZERO_DECIMAL.has(settings.currency) ? 2 : 0;
  return (n: number) =>
    new Intl.NumberFormat(settings.locale, {
      style: 'currency',
      currency: settings.currency,
      maximumFractionDigits: maxFrac,
      minimumFractionDigits: maxFrac,
    }).format(n);
}

export function makeFmtShort(settings: Pick<UserSettings, 'currency' | 'locale'>) {
  // For IDR, KRW, VND, JPY scale is much larger — adjust thresholds
  const billion = ZERO_DECIMAL.has(settings.currency) ? 1_000_000_000 : 1_000_000_000;
  const million  = ZERO_DECIMAL.has(settings.currency) ? 1_000_000     : 1_000_000;
  const kilo     = ZERO_DECIMAL.has(settings.currency) ? 1_000         : 1_000;

  return (n: number) => {
    const abs = Math.abs(n);
    if (abs >= billion) return `${(n / billion).toFixed(1)}B`;
    if (abs >= million)  return `${(n / million).toFixed(1)}M`;
    if (abs >= kilo)     return `${(n / kilo).toFixed(0)}K`;
    return String(Math.round(n));
  };
}