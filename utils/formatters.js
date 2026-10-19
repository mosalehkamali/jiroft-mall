import storeConfig from "base/store.config";
// Format number to Persian locale with thousand separators
export const formatPrice = (price) => {
  return new Intl.NumberFormat('fa-IR').format(price);
};

// Format price with currency
export const formatPriceWithCurrency = (price) => {
  return `${formatPrice(price)} ${storeConfig.commerce.currency.label}`;
};

// Convert English numbers to Persian
export const toPersianNumbers = (num) => {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/[0-9]/g, (digit) => persianDigits[parseInt(digit)]);
};
