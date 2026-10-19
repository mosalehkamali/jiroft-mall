"use client";

import useSWR from "swr";
import { resolveProductRules } from "@/lib/productRules";

const fetcher = (url) => fetch(url).then((r) => (r.ok ? r.json() : null));
const GLOBAL_RULES = resolveProductRules([]);

/**
 * The store's product rules for a category, as the server resolves them
 * (store.config.js + per-category overrides). Until the request returns, the
 * store-wide rules are used, so the form never renders without rules.
 */
export default function useProductRules(categoryId) {
  const { data } = useSWR(`/api/product/rules?category=${categoryId || ""}`, fetcher, {
    revalidateOnFocus: false,
  });
  return data?.rules || GLOBAL_RULES;
}
