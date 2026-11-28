import "base/models/registerModels";
import ReviewCreditTransaction from "base/models/ReviewCreditTransaction";
import WalletTransaction from "base/models/WalletTransaction";

export async function getWalletHistory(userId) {
  const [reviews, historical, wallet] = await Promise.all([
    ReviewCreditTransaction.find({ user: userId }).select("amount createdAt").sort({ createdAt: -1 }).limit(50).lean(),
    WalletTransaction.db.collection("coachwallettransactions").find({ coach: userId }, { projection: { amount: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(50).toArray(),
    WalletTransaction.find({ user: userId }).select("type amount description createdAt").sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  return [...wallet,
    ...reviews.map(tx => ({ ...tx, type: "credit", description: "پاداش نظر تأییدشده" })),
    ...historical.map(tx => ({ ...tx, type: "credit", description: "اعتبار پیشین حساب" })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
}
