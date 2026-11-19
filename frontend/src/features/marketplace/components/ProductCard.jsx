import { MapPin, Clock3 } from "lucide-react";

export default function ProductCard({ product, onClick }) {
  return (
    <button type="button" onClick={onClick} className="product-card product-card-link">
      <div className="product-image">
        <img src={product.image} alt={product.name} />
        <span className="condition-badge">● {product.condition}</span>
      </div>
      <div className="product-info">
        <div className="product-meta">
          <span>{product.category}</span>
          <strong>₱{product.price.toLocaleString()}</strong>
        </div>
        <h3>{product.name}</h3>
        <p className="card-icon-line"><MapPin size={13} /> {product.campus}</p>
        <p className="card-icon-line"><Clock3 size={13} /> {product.posted}</p>
      </div>
    </button>
  );
}
