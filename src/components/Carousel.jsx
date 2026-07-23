import { useState } from "react";
import "./Carousel.css";

// Generic slide carousel used to break up long stacked sections (emote
// categories, stats/trophy room, lobby options, etc.) into swipeable
// pages with arrows + dots, instead of one long scrolling page.
export default function Carousel({ slides, className = "" }) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  const safeIndex = Math.min(index, count - 1);

  const go = (dir) => setIndex((i) => (i + dir + count) % count);

  if (count === 0) return null;

  return (
    <div className={`carousel ${className}`}>
      <div className="carousel__stage">
        <button
          className="carousel__arrow carousel__arrow--prev"
          onClick={() => go(-1)}
          disabled={count <= 1}
          aria-label="Previous slide"
        >
          ‹
        </button>

        <div className="carousel__viewport">
          {slides[safeIndex].label && <div className="carousel__label">{slides[safeIndex].label}</div>}
          <div className="carousel__slide">{slides[safeIndex].content}</div>
        </div>

        <button
          className="carousel__arrow carousel__arrow--next"
          onClick={() => go(1)}
          disabled={count <= 1}
          aria-label="Next slide"
        >
          ›
        </button>
      </div>

      {count > 1 && (
        <div className="carousel__dots">
          {slides.map((s, i) => (
            <button
              key={s.key || i}
              className={`carousel__dot ${i === safeIndex ? "carousel__dot--active" : ""}`}
              onClick={() => setIndex(i)}
              aria-label={s.label ? `Go to ${s.label}` : `Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
