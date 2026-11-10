/**
 * scripts/demoCatalogue.mjs — the `--demo` data of scripts/seed.mjs.
 *
 * A clothing store: categories (two levels), brands, products with size
 * variants, discounts, hero slides, banners, articles and a few reviews, so
 * every storefront section has something to show. Photos are hot-linked from
 * Unsplash (free licence); brand logos are the local wordmarks in
 * public/demo/brands. Demo only — replace everything from the admin panel.
 */
import { hash } from "bcryptjs";
import User from "base/models/User";
import Category from "base/models/Category";
import Brand from "base/models/Brand";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import DiscountRule from "base/models/DiscountRule";
import Slide from "base/models/Slide";
import Banner from "base/models/Banner";
import Article from "base/models/Article";
import ArticleCategory from "base/models/ArticleCategory";
import Comment from "base/models/Comment";
import SiteSetting from "base/models/SiteSetting";
// Same keys as HOME_SLIDER_KEYS in services/product.service.js (that module needs the Next runtime).
const HOME_SLIDER_KEYS = { bestsellers: "home_slider_bestsellers", offers: "home_slider_amazing_offers" };
import { isFeatureEnabled } from "base/src/lib/features";

const photo = (id, w = 900, h = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=75`;

const SIZES = { clothes: ["S", "M", "L", "XL"], pants: ["30", "32", "34", "36"], shoes: ["40", "41", "42", "43", "44"] };

const attr = (name, label, extra = {}) => ({ name, label, uiType: "text-input", required: false, filterable: true, ...extra });
const sizeAttr = (options) => [{ name: "size", label: "سایز", uiType: "button-toggle", required: true, filterable: true, options }];

// [key, title, name(slug), parentKey, image id, sizes]
const CATEGORIES = [
  ["men", "مردانه", "men", null, "1617137968427-85924c800a22"],
  ["women", "زنانه", "women", null, "1469334031218-e382a71b716b"],
  ["acc", "کیف، کفش و اکسسوری", "accessories", null, "1516762689617-e1cffcef479d"],
  ["m-tee", "تی‌شرت مردانه", "men-tshirts", "men", "1521572163474-6864f9cf17ab", SIZES.clothes],
  ["m-shirt", "پیراهن مردانه", "men-shirts", "men", "1598033129183-c4f50c736f10", SIZES.clothes],
  ["m-pants", "شلوار مردانه", "men-pants", "men", "1473966968600-fa801b869a1a", SIZES.pants],
  ["m-hoodie", "هودی و سویشرت", "men-hoodies", "men", "1556821840-3a63f95609a7", SIZES.clothes],
  ["m-jacket", "کت و کاپشن مردانه", "men-jackets", "men", "1591047139829-d91aecb6caea", SIZES.clothes],
  ["w-dress", "پیراهن و سارافون", "women-dresses", "women", "1572804013309-59a88b7e92f1", SIZES.clothes],
  ["w-top", "شومیز و بافت", "women-tops", "women", "1564257631407-4deb1f99d992", SIZES.clothes],
  ["w-pants", "شلوار زنانه", "women-pants", "women", "1594633312681-425c7b97ccd1", SIZES.clothes],
  ["w-coat", "پالتو و کاپشن زنانه", "women-coats", "women", "1539533018447-63fcce2678e3", SIZES.clothes],
  ["shoes", "کفش", "shoes", "acc", "1549298916-b41d501d3772", SIZES.shoes],
  ["bags", "کیف", "bags", "acc", "1584917865442-de89df76afd3"],
  ["hats", "کلاه", "hats", "acc", "1521369909029-2afed882baee"],
];

// [name (slug + logo file), title, country]
const BRANDS = [
  ["Halil", "هلیل", "ایران"],
  ["Sabzvaran", "سبزواران", "ایران"],
  ["Arka", "آرکا", "ایران"],
  ["Novin", "نوین", "ایران"],
  ["Maral", "مارال", "ایران"],
  ["Kavir", "کویر", "ایران"],
];

// [name, category, brand index, price (تومان), main image, color, material, label, discount %, extra gallery ids]
const PRODUCTS = [
  ["تی‌شرت نخی سفید ساده", "m-tee", 0, 480000, "1521572163474-6864f9cf17ab", "سفید", "۱۰۰٪ پنبه", "hot", 0, ["1562157873-818bc0726f68"]],
  ["تی‌شرت مشکی طرح‌دار", "m-tee", 2, 590000, "1503341504253-dff4815485f1", "مشکی", "پنبه سوپر", "new", 15, []],
  ["تی‌شرت کرم چاپی", "m-tee", 3, 620000, "1576566588028-4147f3842f27", "کرم", "پنبه", "none", 0, []],
  ["تی‌شرت مشکی یقه‌گرد", "m-tee", 0, 450000, "1583743814966-8936f5b7be1a", "مشکی", "۱۰۰٪ پنبه", "none", 0, ["1562157873-818bc0726f68"]],
  ["پیراهن جین آستین‌بلند", "m-shirt", 5, 1150000, "1596755094514-f87e34085b2c", "آبی", "جین", "new", 0, []],
  ["پیراهن سفید رسمی", "m-shirt", 2, 980000, "1598033129183-c4f50c736f10", "سفید", "نخ پنبه", "hot", 20, ["1602810318383-e386cc2a3ccf"]],
  ["پیراهن چهارخانه پاییزه", "m-shirt", 3, 890000, "1602810318383-e386cc2a3ccf", "زرشکی", "فلانل", "none", 0, []],
  ["شلوار جین مشکی راسته", "m-pants", 5, 1350000, "1542272604-787c3835535d", "مشکی", "جین کشی", "hot", 0, []],
  ["شلوار کتان خاکی", "m-pants", 0, 1090000, "1473966968600-fa801b869a1a", "خاکی", "کتان", "none", 10, []],
  ["شلوار پارچه‌ای سرمه‌ای", "m-pants", 2, 1240000, "1624378439575-d8705ad7ae80", "سرمه‌ای", "فاستونی", "none", 0, []],
  ["هودی طوسی کلاه‌دار", "m-hoodie", 3, 1480000, "1556821840-3a63f95609a7", "طوسی", "دورس پنبه", "hot", 0, []],
  ["سویشرت سفید یقه‌گرد", "m-hoodie", 0, 1190000, "1620799140408-edc6dcb6d633", "سفید", "دورس", "new", 25, []],
  ["کاپشن چرم مشکی", "m-jacket", 5, 4200000, "1551028719-00167b16eac5", "مشکی", "چرم مصنوعی", "limited", 0, []],
  ["کاپشن بامبر آجری", "m-jacket", 2, 2650000, "1591047139829-d91aecb6caea", "آجری", "پلی‌استر", "new", 0, []],
  ["کت تک سرمه‌ای", "m-jacket", 1, 3900000, "1617137968427-85924c800a22", "سرمه‌ای", "فاستونی", "none", 15, []],
  ["پیراهن بلند قرمز مجلسی", "w-dress", 4, 2850000, "1595777457583-95e059d581b8", "قرمز", "حریر", "hot", 0, []],
  ["پیراهن گل‌دار تابستانه", "w-dress", 4, 1750000, "1572804013309-59a88b7e92f1", "قرمز", "ویسکوز", "new", 20, []],
  ["پیراهن سفید کوتاه", "w-dress", 1, 1620000, "1515372039744-b8f02a3ae446", "سفید", "کتان", "none", 0, []],
  ["سارافون گل‌دار بهاره", "w-dress", 1, 1490000, "1496747611176-843222e1e57c", "کرم", "نخ", "none", 30, []],
  ["بافت کرم ریشه‌دار", "w-top", 4, 1380000, "1434389677669-e08b4cac3105", "کرم", "بافت اکریلیک", "new", 0, []],
  ["شومیز سفید گلدوزی", "w-top", 1, 1120000, "1564257631407-4deb1f99d992", "سفید", "نخ پنبه", "hot", 0, []],
  ["پلیور نارنجی یقه‌گرد", "w-top", 3, 1290000, "1578587018452-892bacefd3f2", "نارنجی", "بافت", "none", 15, []],
  ["شلوار راحتی صورتی", "w-pants", 4, 990000, "1594633312681-425c7b97ccd1", "صورتی", "کرپ", "none", 0, []],
  ["شلوار جین زاپ‌دار", "w-pants", 5, 1280000, "1541099649105-f69ad21f3246", "آبی", "جین", "new", 0, []],
  ["شلوار راه‌راه دمپا", "w-pants", 1, 1190000, "1509631179647-0177331693ae", "مشکی", "کرپ", "none", 20, []],
  ["کاپشن زیتونی زنانه", "w-coat", 3, 3100000, "1544022613-e87ca75a784a", "زیتونی", "کتان آستردار", "new", 0, []],
  ["پالتو شتری بلند", "w-coat", 4, 4650000, "1539533018447-63fcce2678e3", "شتری", "فوتر پشمی", "limited", 10, []],
  ["کتانی قهوه‌ای روزمره", "shoes", 2, 2350000, "1549298916-b41d501d3772", "قهوه‌ای", "جیر", "hot", 0, ["1516762689617-e1cffcef479d"]],
  ["کیف دستی قرمز", "bags", 4, 1950000, "1584917865442-de89df76afd3", "قرمز", "چرم مصنوعی", "new", 0, []],
  ["کوله‌پشتی سرمه‌ای", "bags", 5, 1450000, "1553062407-98eeb64c6a62", "سرمه‌ای", "برزنت ضدآب", "none", 15, []],
  ["کلاه نقاب‌دار سفید", "hats", 0, 290000, "1588850561407-ed78c282e89b", "سفید", "کتان", "none", 0, []],
  ["کلاه نقاب‌دار طوسی", "hats", 3, 320000, "1521369909029-2afed882baee", "طوسی", "جین سنگ‌شور", "none", 0, []],
];

// [slug, title, cover id, excerpt]
const ARTICLES = [
  ["choose-the-right-size", "راهنمای انتخاب سایز مناسب", "1441986300917-64674bd600d8", "چطور بدون پرو کردن، سایز درست را آنلاین انتخاب کنیم."],
  ["autumn-color-trends", "رنگ‌های پرطرفدار پاییز امسال", "1441984904996-e0b6ba687e04", "از شتری و زیتونی تا سرمه‌ای؛ رنگ‌هایی که این فصل زیاد می‌بینید."],
  ["capsule-wardrobe", "کمد لباس کپسولی چیست؟", "1558769132-cb1aea458c5e", "با تعداد کمی لباس، ست‌های زیادی بسازید."],
  ["how-to-wash-cotton", "شست‌وشوی درست لباس‌های نخی", "1523381210434-271e8be1f52b", "چند نکته ساده تا تی‌شرت‌ها آب نروند و رنگشان بماند."],
  ["smart-casual-guide", "استایل نیمه‌رسمی برای محل کار", "1567401893414-76b7b1e5a7a5", "ترکیب پیراهن، شلوار کتان و کت تک."],
  ["denim-care", "نگهداری از شلوار جین", "1489987707025-afc232f7ea0f", "هر چند وقت یک‌بار جین را بشوییم و چطور خشک کنیم."],
  ["layering-in-winter", "لایه‌پوشی در زمستان", "1445205170230-053b83016050", "گرم بمانید بدون اینکه حجیم به نظر برسید."],
  ["shopping-checklist", "چک‌لیست خرید لباس آنلاین", "1483985988355-763728e1935b", "قبل از ثبت سفارش این چند مورد را بررسی کنید."],
];

const REVIEWS = [
  "جنس پارچه خیلی خوبه و سایزش دقیقاً مطابق جدول بود.",
  "بسته‌بندی مرتب و ارسال سریع. رنگش همونیه که توی عکس هست.",
  "برای هدیه خریدم و خیلی پسندیدن. دوختش تمیزه.",
  "بعد از چند بار شست‌وشو هنوز مثل روز اوله. پیشنهاد می‌کنم.",
];

export async function seedDemo({ adminPhone }) {
  if (await Product.exists({})) {
    console.log("• products already exist — demo catalogue skipped");
    return;
  }

  /* categories */
  const cats = {};
  for (const [key, title, name, parentKey, image, sizes] of CATEGORIES) {
    cats[key] = await Category.create({
      title, name, slug: name, sport: null,
      parent: parentKey ? cats[parentKey]._id : null,
      image: photo(image, 800, 800),
      order: Object.keys(cats).length,
      attributes: parentKey ? [attr("material", "جنس"), attr("madeIn", "کشور سازنده", { filterable: false })] : [],
      variantAttributes: sizes ? sizeAttr(sizes) : [],
    });
  }

  /* brands */
  const brands = [];
  if (isFeatureEnabled("brands")) {
    for (const [i, [name, title, country]] of BRANDS.entries()) {
      brands.push(await Brand.create({
        name, title, country, slug: name.toLowerCase(), order: i,
        logo: `/demo/brands/${name.toLowerCase()}.svg`,
        description: `${title} — برند نمونه پوشاک برای نمایش فروشگاه.`,
      }));
    }
  }

  /* products + size variants */
  const products = [];
  const discounted = [];
  for (const [i, [name, catKey, brandIndex, basePrice, main, color, material, label, off, gallery]] of PRODUCTS.entries()) {
    const category = cats[catKey];
    const product = await Product.create({
      name,
      sku: `JM-${String(i + 1).padStart(3, "0")}`,
      shortDescription: `${name} از جنس ${material}، مناسب استفاده روزمره.`,
      longDescription: `${name} با دوخت تمیز و پارچه ${material}. این محصول داده نمونه است و فقط برای نمایش ظاهر فروشگاه اضافه شده.`,
      category: category._id,
      brand: brands[brandIndex]?._id || null,
      basePrice,
      color,
      label,
      mainImage: photo(main),
      gallery: [photo(main), ...gallery.map((id) => photo(id))],
      attributes: { material, madeIn: "ایران" },
      tag: [category.title, color],
      order: i,
      isActive: true,
    });
    const sizes = category.variantAttributes[0]?.options || [];
    for (const size of sizes) {
      const variant = await Variant.create({
        productId: product._id, categoryId: category._id,
        sku: `${product.sku}-${size}`, attributes: { size }, price: basePrice,
      });
      product.variants.push(variant._id);
    }
    if (sizes.length) await product.save();
    products.push(product);
    if (off) discounted.push({ product, off });
  }

  /* discounts → the "offers" slider */
  if (isFeatureEnabled("discounts")) {
    for (const { product, off } of discounted) {
      await DiscountRule.create({
        title: `تخفیف ${off}٪ — ${product.name}`,
        type: "product", targets: [product._id],
        discount: { kind: "percent", value: off }, active: true,
      });
    }
  }
  const setting = (key, value) => SiteSetting.updateOne({ key }, { $set: { value } }, { upsert: true });
  await setting(HOME_SLIDER_KEYS.bestsellers, products.filter((p) => p.label === "hot" || p.label === "new").slice(0, 12).map((p) => String(p._id)));
  await setting(HOME_SLIDER_KEYS.offers, discounted.map(({ product }) => String(product._id)));

  /* hero + banners */
  const slides = [
    ["1483985988355-763728e1935b", "کالکشن پاییزه رسید", "جدیدترین مدل‌های مردانه و زنانه", "/products"],
    ["1441984904996-e0b6ba687e04", "استایل هر روز شما", "پوشاک باکیفیت با ارسال به سراسر کشور", "/men"],
    ["1445205170230-053b83016050", "تا ۳۰٪ تخفیف", "روی منتخبی از پیراهن‌ها و شلوارها", "/women"],
  ];
  for (const [i, [image, title, subtitle, link]] of slides.entries()) {
    await Slide.create({ position: "home", image: photo(image, 1920, 800), title, subtitle, link, priority: i });
  }
  const banners = [
    ["wide", "luxury", "1490481651871-ab68de25d43d", "ست‌های پاییزه", "کت، بافت و پالتو", "جدید", "/women-coats"],
    ["tall-1", "overlay-photo", "1617137968427-85924c800a22", "مردانه", "پیراهن و کت تک", "پرفروش", "/men"],
    ["tall-2", "overlay-photo", "1469334031218-e382a71b716b", "زنانه", "پیراهن و شومیز", "جدید", "/women"],
    ["strip", "luxury", "", "ارسال رایگان برای خریدهای بالای ۲ میلیون تومان", "", "", "/products"],
  ];
  for (const [position, template, image, title, subtitle, badge, link] of banners) {
    await Banner.create({
      position, template, title, subtitle, badge, link, ctaText: "مشاهده",
      images: image ? { imageUrl: photo(image, 900, 1100) } : {},
    });
  }

  const admin = await User.findOne({ phone: adminPhone });

  /* articles — the homepage block needs exactly 8 with a cover */
  if (isFeatureEnabled("articles") && admin) {
    const category = await ArticleCategory.create({ name: "راهنمای خرید و استایل", slug: "style-guide", status: "active", createdBy: admin._id });
    const ids = [];
    for (const [slug, title, cover, excerpt] of ARTICLES) {
      const article = await Article.create({
        title, slug, excerpt, category: category._id, author: admin._id,
        status: "published", featured: true,
        cover: { url: photo(cover, 1200, 800), alt: title, width: 1200, height: 800 },
        blocks: [
          { id: `${slug}-p1`, type: "paragraph", data: { text: excerpt } },
          { id: `${slug}-h1`, type: "heading", data: { text: "چند نکته کاربردی", level: "h2" } },
          { id: `${slug}-p2`, type: "paragraph", data: { text: "این مقاله داده نمونه است و فقط برای نمایش ظاهر مجله فروشگاه اضافه شده. متن واقعی را از پنل مدیریت جایگزین کنید." } },
        ],
      });
      ids.push(String(article._id));
    }
    await setting("home_featured_article_ids", ids);
  }

  /* reviews */
  if (isFeatureEnabled("reviews")) {
    const password = await hash(Math.random().toString(36), 10);
    const customers = [];
    for (const [i, name] of ["سارا", "علی", "مریم", "رضا"].entries()) {
      customers.push(await User.create({ provider: "local", phone: `0900000000${i + 1}`, phoneVerified: true, password, name, role: "user" }));
    }
    for (const [i, product] of products.slice(0, 16).entries()) {
      const count = 1 + (i % 3);
      for (let n = 0; n < count; n += 1) {
        await Comment.create({
          user: customers[(i + n) % customers.length]._id, product: product._id,
          text: REVIEWS[(i + n) % REVIEWS.length], rating: 5 - ((i + n) % 2),
          status: "approved", approved: true, isVerifiedPurchase: true,
        });
      }
      await Product.updateOne({ _id: product._id }, { $set: { score: 4.5 } });
    }
  }

  console.log(`✓ demo catalogue: ${CATEGORIES.length} categories, ${brands.length} brands, ${products.length} products, ${discounted.length} discounts, ${slides.length} slides, ${banners.length} banners, ${ARTICLES.length} articles`);
}
