import { FiMapPin, FiChevronLeft, FiEdit2 } from 'react-icons/fi';

const AddressSelector = ({ selectedAddress, onOpenModal }) => {
  return (
    <div className="bg-white rounded-[8px] border border-gray-200 p-5 md:p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--color-text)]">
          <FiMapPin className="w-5 h-5 text-[var(--color-primary)]" />
          آدرس تحویل
        </h2>

        {selectedAddress && (
          <button
            onClick={onOpenModal}
            className="
              text-sm text-[var(--color-primary)]
              hover:underline
              flex items-center gap-1
            "
          >
            <FiEdit2 className="w-4 h-4" />
            تغییر
          </button>
        )}
      </div>

      {selectedAddress ? (
        <div
          className="
            relative rounded-[6px] border border-[var(--color-primary)]/30
            bg-[var(--color-secondary)]/10
            p-4
          "
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-secondary)]/30 text-[var(--color-primary)] font-medium">
              {selectedAddress.title}
            </span>

            <span className="text-sm font-medium text-[var(--color-text)]">
              {selectedAddress.fullName}
            </span>
          </div>

          <p className="text-sm text-gray-600 mb-2 leading-relaxed">
            {[selectedAddress.city, selectedAddress.addressLine].filter(Boolean).join('، ')}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
            <span>تلفن: {selectedAddress.phone}</span>
            {selectedAddress.postalCode && (
              <span>کد پستی: {selectedAddress.postalCode}</span>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={onOpenModal}
          className="
            w-full py-4
            border-2 border-dashed border-gray-300
            rounded-[6px]
            text-sm text-gray-600
            hover:border-[var(--color-primary)]
            hover:text-[var(--color-primary)]
            transition
            flex items-center justify-center gap-2
          "
        >
          <FiMapPin className="w-5 h-5" />
          انتخاب آدرس تحویل
          <FiChevronLeft className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default AddressSelector;
