import { Suspense } from "react";
import { getProductForPage, getProductPageData } from "@/lib/productPageData";
import { ProductSchemaWithReviews } from "@/components/templates/product/DeferredProductReviews";
import TaxonomyBreadcrumbs from "@/components/seo/TaxonomyBreadcrumbs";
import { getPublicProductPrice } from "base/services/publicProductPrice.service";
import ProductTemplate from "@/components/templates/product/ProductTemplate";
import { eurToToman } from "@/lib/currency";
import { generateProductMetadata } from "@/lib/seo/productSeo";
import { generateBreadcrumbSchema } from "@/lib/seo/breadcrumbSchema";
import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/features";

// ⚠️ اسلاگ‌های فارسی در URL با کش روتِ Next ناسازگارند: Next مسیرِ دیکدشده را
// خام داخل هدر x-next-cache-tags می‌گذارد و کاراکتر غیر-ASCII باعث
// «ERR_INVALID_CHAR / Invalid character in header content» و خطای ۵۰۰ می‌شود
// (باگ Next در lib/implicit-tags.js). راه‌حل: این مسیر داینامیک رندر شود تا هدر
// کش روت ساخته نشود. هزینه‌ی دیتابیس همچنان با unstable_cache در لایه‌ی سرویس
// کش می‌ماند، پس مشکلِ اتصال برنمی‌گردد.
export const dynamic = "force-dynamic";

// --------------------
// Dynamic Metadata
// --------------------
export async function generateMetadata({ params }) {
  const { productSlug } = await params;

  // از همان سرویس کش‌شده استفاده می‌شود تا کوئری دوباره به دیتابیس نخورد
  const product = await getProductForPage(productSlug);

  if (!product || product.error) {
    return { title: "محصول پیدا نشد" };
  }

  return generateProductMetadata(product);
}

export default async function ProductPage({ params }) {
  const { productSlug } = await params;

  if (!productSlug) {
    notFound();
  }

  const { product: fetchProduct, rate, pricing, reviewsPromise, personalized } = await getProductPageData(productSlug);
  if (!fetchProduct || fetchProduct.error) notFound();

  // تبدیل قیمت پایه محصول
  const priceInToman = eurToToman(fetchProduct.basePrice, rate);

  // تبدیل قیمت تمام واریانت‌ها
  const convertedVariants =
    fetchProduct.variants?.map((variant) => ({
      ...variant,
      price: eurToToman(variant.price, rate),
    })) || [];

  // محصول نهایی با قیمت‌های تبدیل شده
  const product = {
    ...fetchProduct,
    basePrice: priceInToman,
    finalPriceToman: pricing.finalPriceToman,
    displayPrice: JSON.parse(JSON.stringify(pricing)),
    variants: convertedVariants,
  };

  // Structured data stays public even when the buy box has a role-specific price.
  const publicPricePromise = personalized ? getPublicProductPrice(fetchProduct, rate) : Promise.resolve(pricing);
  const breadcrumbSchema = generateBreadcrumbSchema(product);

  return (
    <>
      <Suspense fallback={null}>
        <ProductSchemaWithReviews product={product} reviewsPromise={reviewsPromise} publicPricePromise={publicPricePromise} />
      </Suspense>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />

      <TaxonomyBreadcrumbs filters={{ sport: product.sport, category: product.category, brand: product.brand, serie: product.serie }} currentItem={false} includeStructuredData={false} />

      <ProductTemplate
        product={product}
        reviewsPromise={reviewsPromise}
        rate={rate}
      />
    </>
  );
}
