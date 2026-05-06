export const CATEGORY_TRANSLATIONS: Record<string, string> = {
  'Transfer Masuk': 'Incoming Transfer',
  'Makan & Minum': 'Food & Drink',
  'Belanja': 'Shopping',
  'Tagihan & Utilitas': 'Bills & Utilities',
  'Pulsa & Internet': 'Phone & Internet',
  'Hiburan': 'Entertainment',
  'Kesehatan': 'Health',
  'Sewa & Kost': 'Rent & Housing',
  'Pendidikan': 'Education',
  'Tabungan & Investasi': 'Savings & Investment',
  'Lainnya': 'Other',
  'Transport & Ojol': 'Transport & Rideshare',
  'Bisnis': 'Business',
  'Gaji': 'Salary',
  'Freelance': 'Freelance',
  'No category': 'No category',
};

export function translateCategory(name: string): string {
  return CATEGORY_TRANSLATIONS[name] ?? name;
}
