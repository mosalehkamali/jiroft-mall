"use client";

import storeConfig from "base/store.config";
import { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay, Pagination } from "swiper/modules";
import { FiArrowLeft, FiArrowRight, FiPlusCircle } from "react-icons/fi";
import "swiper/css";
import "swiper/css/pagination";
import ProductCard from "@/components/modules/cart/ProductCard";
import QuickViewModal from "@/components/modules/cart/QuickViewModal";
import Link from "next/link";
import HomeSectionHeading from "@/components/features/home/HomeSectionHeading";
import { HOME_SLIDER_AUTOPLAY, HOME_SLIDER_SPEED } from "@/lib/homeSlider";

export default function ProductSlider({
  title = "پیشنهادهای شگفت انگیز",
  subtitle = "محبوب‌ترین انتخاب‌های مشتریان ما",
  products = [],
  rate,
  onToggleWishlist,
}) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openQuickView = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const closeQuickView = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  return (
    <section className="py-6 md:py-8 bg-[#fcfcfc] relative overflow-hidden group/section">
      {/* المان‌های پس‌زمینه بهینه شده */}
      <div className="absolute top-[-5%] left-[-5%] w-[250px] md:w-[400px] h-[250px] md:h-[400px] bg-[var(--color-primary)]/5 rounded-full blur-[80px] md:blur-[100px] pointer-events-none" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={storeConfig.brand.logo} alt="" aria-hidden="true" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[85%] w-auto max-w-none opacity-[0.05] select-none pointer-events-none z-0" />

      <div className="site-container relative z-10">
        {/* هدر */}
        <div className="relative flex flex-col md:flex-row md:items-end justify-between mb-4 md:mb-5">
          <HomeSectionHeading title={title} highlight="پیشنهادهای" subtitle={subtitle} />

          <div className="hidden md:flex items-center mt-8 md:mt-0">
            <div className="flex bg-white/80 backdrop-blur-md shadow-xl shadow-black/5 rounded-[16px] p-1 border border-white/50">
              <button className="product-prev-btn-2 w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all duration-300 rounded-[12px]">
                <FiArrowRight size={22} />
              </button>
              <div className="w-[1px] h-6 bg-gray-100 self-center mx-1"></div>
              <button className="product-next-btn-2 w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all duration-300 rounded-[12px]">
                <FiArrowLeft size={22} />
              </button>
            </div>
          </div>
        </div>

        {/* اسلایدر */}
        <div className="relative overflow-hidden">
          <Swiper
            modules={[Navigation, Autoplay, Pagination]}
            spaceBetween={4}
            slidesPerView={2.1}
            centeredSlides={false}
            watchOverflow={true}
            speed={HOME_SLIDER_SPEED}
            autoplay={{ ...HOME_SLIDER_AUTOPLAY }}
            navigation={{
              nextEl: ".product-next-btn-2",
              prevEl: ".product-prev-btn-2",
            }}
            pagination={{
              el: ".slider-pagination-2",
              clickable: true,
            }}
            breakpoints={{
              640: {
                slidesPerView: 2.5,
                spaceBetween: 6,
              },
              768: {
                slidesPerView: 3,
                spaceBetween: 6,
              },
              1024: {
                slidesPerView: 3,
                spaceBetween: 6,
              },
              1400: {
                slidesPerView: 4,
                spaceBetween: 8,
              },
            }}
          >
            {products.map((product, index) => (
              <SwiperSlide key={product._id || index} className="h-auto pb-2">
                <div className="h-full">
                  <ProductCard
                    product={product}
                    rate={rate}
                    isWishlisted={product.isWishlisted}
                    onQuickView={() => openQuickView(product)}
                    onToggleWishlist={() => onToggleWishlist?.(product)}
                  />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

        {/* پیجینیشن و لینک پایین */}
        <div className="flex flex-row items-center justify-between gap-3 md:gap-6 mt-3">
          <div className="slider-pagination-2 !w-auto flex md:gap-2"></div>
          <Link
            href="/products"
            className="group flex items-center gap-2 bg-white px-5 py-2.5 md:px-6 md:py-3 rounded-full shadow-sm border border-gray-100 text-gray-900 font-bold text-xs md:text-sm hover:bg-[var(--color-primary)] hover:text-white transition-all duration-300 w-full sm:w-auto justify-center"
            >
            مشاهده کاتالوگ محصولات
            <FiPlusCircle className="text-lg md:text-xl group-hover:rotate-180 transition-transform duration-500" />
          </Link>
        </div>
      </div>
            </div>

      <QuickViewModal
        product={selectedProduct}
        rate={rate}
        isOpen={isModalOpen}
        onClose={closeQuickView}
        onToggleWishlist={() => onToggleWishlist?.(selectedProduct)}
        isWishlisted={selectedProduct?.isWishlisted}
      />
    </section>
  );
}
