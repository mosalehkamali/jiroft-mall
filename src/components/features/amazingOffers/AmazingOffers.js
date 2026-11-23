"use client";

import { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay, Pagination } from "swiper/modules";
import { FiPlusCircle } from "react-icons/fi";
import "swiper/css";
import "swiper/css/pagination";
import ProductCard from "@/components/modules/cart/ProductCard";
import QuickViewModal from "@/components/modules/cart/QuickViewModal";
import Link from "next/link";
import HomeSliderNav from "@/components/features/home/HomeSliderNav";
import HomeSectionHeading from "@/components/features/home/HomeSectionHeading";
import { HOME_SLIDER_AUTOPLAY, HOME_SLIDER_SPEED } from "@/lib/homeSlider";

export default function ProductSlider({
  title = "پیشنهادهای شگفت انگیز",
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
    <section className="py-6 md:py-8 product-slider-section relative overflow-hidden group/section">
      <div className="site-container">
        {title && <HomeSectionHeading compact title={title} highlight="پیشنهادهای" />}

        <div className="relative">
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
          <HomeSliderNav sideControls prevClass="product-prev-btn-2" nextClass="product-next-btn-2" />
        </div>

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
