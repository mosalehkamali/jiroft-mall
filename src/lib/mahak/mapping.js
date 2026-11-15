/**
 * Mahak rows → what the site stores. Pure functions, no database, no network.
 *
 * Mahak model (from the API spec):
 *   Product        the item (name, group)
 *   ProductDetail  one sellable unit of it (barcode, 10 price levels, `properties`)
 *                  — a product with size/colour has one detail per combination
 *   VisitorProduct "this detail is assigned to this client" (+ a count)
 *   ProductDetailStoreAsset  stock of a detail in one warehouse
 */

export const FALLBACK_ATTRIBUTE = "مدل";

const NAME_KEYS = ["name", "title", "propertyname", "key", "label"];
const VALUE_KEYS = ["value", "propertyvalue", "val", "text"];
const clean = (v) => (v == null ? "" : String(v).trim());

function pick(obj, keys) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (keys.includes(k.toLowerCase()) && clean(v)) return clean(v);
  }
  return "";
}

/**
 * ProductDetail.properties is an undocumented string. Accepted: a JSON array of
 * {name,value}-like objects, a JSON object map, or plain text (one unnamed
 * value). Anything else → no properties.
 * @returns {{name:string,value:string}[]}
 */
export function parseProperties(raw) {
  const text = clean(raw);
  if (!text) return [];
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [{ name: FALLBACK_ATTRIBUTE, value: text }];
  }
  if (Array.isArray(parsed)) {
    return parsed
      .map((p) => (p && typeof p === "object" ? { name: pick(p, NAME_KEYS), value: pick(p, VALUE_KEYS) } : { name: "", value: "" }))
      .filter((p) => p.name && p.value);
  }
  if (parsed && typeof parsed === "object") {
    return Object.entries(parsed)
      .filter(([, v]) => v == null || typeof v !== "object")
      .map(([k, v]) => ({ name: clean(k), value: clean(v) }))
      .filter((p) => p.name && p.value);
  }
  return clean(parsed) ? [{ name: FALLBACK_ATTRIBUTE, value: clean(parsed) }] : [];
}

/** Site unit price of a detail at a price level (0 = the detail's default level). */
export function detailPrice(detail, { level = 0, divisor = 1 } = {}) {
  const l = level || Number(detail?.defaultSellPriceLevel) || 1;
  const raw = Number(detail?.[`price${l}`]) || 0;
  return Math.max(0, Math.round(raw / (divisor || 1)));
}

/**
 * Units Mahak has for a detail.
 *   storeAssets      Σ count1 over its warehouses (optionally only `storeIds`)
 *   visitorProducts  the count on the client assignment
 *   auto             warehouses when the account reports any, else the assignment
 */
export function mahakStock({ visitorProduct, assets = [], source = "auto", storeIds = null, accountHasAssets = false }) {
  const live = assets.filter((a) => !a.deleted && (!storeIds?.length || storeIds.includes(a.storeId)));
  const fromAssets = live.reduce((s, a) => s + (Number(a.count1) || 0), 0);
  const fromVisitor = visitorProduct && !visitorProduct.deleted ? Number(visitorProduct.count1) || 0 : 0;
  const useAssets = source === "storeAssets" || (source === "auto" && accountHasAssets);
  return Math.max(0, Math.floor(useAssets ? fromAssets : fromVisitor));
}

const comboKey = (attrs) =>
  Object.keys(attrs)
    .sort()
    .map((k) => `${k}=${attrs[k]}`)
    .join("&");

/**
 * The site shape of one Mahak product.
 *
 * @param product   ProductModel
 * @param details   its ProductDetailModel rows
 * @param assigned  (productDetailId) => boolean — is the detail assigned to this client
 * @returns null when nothing sellable is left, else
 *   { name, categoryId, hasVariants, attributeNames, lines: [{ productDetailId, barcode, price, buyPrice, attributes }] }
 */
export function planProduct(product, details, { assigned = () => true, level = 0, divisor = 1, buyLevel = 0 } = {}) {
  if (!product || product.deleted) return null;
  const live = details
    .filter((d) => !d.deleted && assigned(d.productDetailId))
    .sort((a, b) => a.productDetailId - b.productDetailId);
  if (!live.length) return null;

  let lines = live.map((d) => ({
    productDetailId: d.productDetailId,
    barcode: clean(d.barcode),
    price: detailPrice(d, { level, divisor }),
    buyPrice: buyLevel ? detailPrice(d, { level: buyLevel, divisor }) : null,
    attributes: Object.fromEntries(parseProperties(d.properties).map((p) => [p.name, p.value])),
    rawProperties: clean(d.properties),
  }));

  const anyProps = lines.some((l) => Object.keys(l.attributes).length);
  const hasVariants = lines.length > 1 || anyProps;
  if (hasVariants) {
    const names = [...new Set(lines.flatMap((l) => Object.keys(l.attributes)))];
    const complete = names.length > 0 && lines.every((l) => names.every((n) => l.attributes[n]));
    const unique = new Set(lines.map((l) => comboKey(l.attributes))).size === lines.length;
    if (!complete || !unique) {
      // Unreadable or clashing properties: every detail still has to be its own
      // variant, so name each by what Mahak shows for it.
      lines = lines.map((l) => ({
        ...l,
        attributes: {
          [FALLBACK_ATTRIBUTE]:
            [Object.values(l.attributes).join(" / "), l.barcode, String(l.productDetailId)].find(Boolean),
        },
      }));
      const seen = new Set();
      for (const l of lines) {
        if (seen.has(l.attributes[FALLBACK_ATTRIBUTE])) l.attributes[FALLBACK_ATTRIBUTE] += ` (${l.productDetailId})`;
        seen.add(l.attributes[FALLBACK_ATTRIBUTE]);
      }
    }
  }
  return {
    name: clean(product.name) || `کالای ${product.productCode || product.productId}`,
    categoryId: Number(product.productCategoryId) || 0,
    hasVariants,
    attributeNames: hasVariants ? [...new Set(lines.flatMap((l) => Object.keys(l.attributes)))] : [],
    lines: lines.map(({ rawProperties, ...l }) => l),
  };
}

/** Split `total` over `weights` proportionally in whole units; the sum is exact. */
export function allocate(total, weights) {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (!sum || !total) return weights.map(() => 0);
  const out = weights.map((w) => Math.floor((total * w) / sum));
  out[out.length - 1] += total - out.reduce((s, v) => s + v, 0);
  return out;
}

/**
 * SaveAllData body for one account's part of an order.
 *
 * @param order   { trackingCode, orderDate, description, address.snapshot }
 * @param lines   [{ productDetailId, quantity, unitPrice }]  site amounts
 * @param ids     { orderClientId, personClientId, visitorId }
 * @param person  { firstName, lastName, mobile }
 * @param discount  site amount of the order-level discount that falls on these lines
 * @param multiplier  site amount × multiplier = Mahak amount (the price divisor)
 */
export function buildInvoicePayload({ order, lines, ids, person, discount = 0, multiplier = 1, orderType = 201 }) {
  const snap = order.address?.snapshot || {};
  const k = multiplier || 1; // site amount × multiplier = Mahak amount
  return {
    people: [
      {
        personClientId: ids.personClientId,
        personType: 0,
        firstName: clean(person.firstName),
        lastName: clean(person.lastName),
        mobile: clean(person.mobile),
        state: clean(snap.province),
        city: clean(snap.city),
        address: clean(snap.addressLine),
        postalCode: clean(snap.postalCode),
        deleted: false,
      },
    ],
    orders: [
      {
        orderClientId: ids.orderClientId,
        personClientId: ids.personClientId,
        visitorId: ids.visitorId,
        orderType,
        orderDate: new Date(order.orderDate || Date.now()).toISOString(),
        discount: Math.round(discount * k),
        discountType: 0,
        settlementType: 1,
        description: `سفارش سایت ${order.trackingCode || ""}${order.description ? ` — ${order.description}` : ""}`.trim(),
        shippingAddress: JSON.stringify({
          title: clean(snap.fullName),
          address: [snap.province, snap.city, snap.addressLine].map(clean).filter(Boolean).join("، "),
          postalcode: clean(snap.postalCode),
          mobile: clean(snap.phone),
        }),
        deleted: false,
      },
    ],
    orderDetails: lines.map((l, i) => ({
      orderDetailClientId: ids.orderClientId * 1000 + i + 1,
      orderClientId: ids.orderClientId,
      itemType: 1,
      productDetailId: l.productDetailId,
      price: Math.round(l.unitPrice * k),
      count1: l.quantity,
      discount: 0,
      discountType: 0,
      rowId: i + 1,
      deleted: false,
    })),
  };
}

/** Errors of a SaveAllData answer for the entities we sent ("" = all rows saved). */
export function saveErrors(objects, entities = ["people", "orders", "orderDetails"]) {
  const out = [];
  for (const e of entities) {
    const results = objects?.[e]?.results;
    if (!Array.isArray(results) || !results.length) {
      out.push(`${e}: پاسخی از محک نیامد`);
      continue;
    }
    for (const r of results) {
      if (r?.result) continue;
      const why = (r?.errors || []).map((x) => [x.property, x.error].filter(Boolean).join(": ")).join("؛ ");
      out.push(`${e}[${r?.index ?? "?"}]: ${why || "رد شد"}`);
    }
  }
  return out.join(" | ");
}
