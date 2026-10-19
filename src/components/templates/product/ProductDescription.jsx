const ProductDescription = ({ description }) => {
  return (
    <div
      className="
        animate-[fadeIn_0.25s_ease-out]
        text-[hsl(var(--foreground))]
        leading-relaxed
        whitespace-pre-line
        text-sm
        sm:text-base
      "
    >
      <div 
    className="selection:bg-[var(--color-primary)]/10 selection:text-[var(--color-primary)]"
      dangerouslySetInnerHTML={{ __html: description }} 
    />
    </div>
  );
};

export default ProductDescription;
