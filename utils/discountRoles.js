export const discountRoles = ["user", "national_player", "store"];
export const visibleDiscountRules = {
  $or: [{ type: { $ne: "userRole" } }, { targetRoles: { $in: discountRoles } }],
};
export function adminDiscountRule(rule) {
  return { ...rule, targetRoles: (rule.targetRoles || []).filter(role => discountRoles.includes(role)) };
}
